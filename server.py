"""Zero-dependency web server for an offline, synthetic-data hackathon MVP.
Run: python server.py
"""
import csv
import io
import json
import mimetypes
import os
import secrets
import sys
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse,parse_qs
from model import QUESTIONS, COHORTS, DIMENSIONS, SCALE, MIN_GROUP, CHECKLIST, recommend
from store import connection, init, get_cycles, get_cycle, snapshot, salted_hash, audit, reset, now

BASE=Path(__file__).resolve().parent
SESSIONS={}
SESSION_LOCK=Lock()
MAX_BODY=64_000


def rowdicts(cursor): return [dict(x) for x in cursor]


class Handler(BaseHTTPRequestHandler):
    server_version='IntegrityOS/1.0'
    def log_message(self, fmt, *args):
        # Do not log IP addresses or survey request metadata.
        pass

    def send_json(self,obj,status=200,headers=None):
        data=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        for k,v in (headers or {}).items(): self.send_header(k,v)
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def error(self,msg,status=400): self.send_json({'error':msg},status)

    def read_json(self):
        try: length=int(self.headers.get('Content-Length','0'))
        except: return None
        if length>MAX_BODY or length<0: return None
        try: return json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
        except (ValueError,UnicodeDecodeError): return None

    def who(self):
        try:
            c=SimpleCookie(); c.load(self.headers.get('Cookie',''))
            token=c['integrity_session'].value
            with SESSION_LOCK:
                return SESSIONS.get(token)
        except (KeyError, ValueError): return None

    def require(self,roles):
        user=self.who()
        if not user: self.error('Потрібна авторизація',401); return None
        if user['role'] not in roles: self.error('Недостатньо повноважень',403); return None
        return user

    def safe_origin(self):
        origin=self.headers.get('Origin')
        if not origin: return True  # same-origin curl/API clients, e.g. integration
        try:
            target=urlparse(origin)
            return target.scheme in ('http','https') and target.netloc==self.headers.get('Host')
        except: return False

    def serve_file(self,path):
        path = (BASE/'static'/path).resolve()
        static=(BASE/'static').resolve()
        if not path.is_relative_to(static) or not path.is_file(): return self.error('Не знайдено',404)
        data=path.read_bytes()
        typ,_=mimetypes.guess_type(str(path))
        self.send_response(200)
        self.send_header('Content-Type',(typ or 'application/octet-stream')+'; charset=utf-8' if (typ or '').startswith(('text/','application/javascript')) else (typ or 'application/octet-stream'))
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-cache')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        parsed=urlparse(self.path)
        path=parsed.path
        query=parse_qs(parsed.query)
        if path=='/' or path=='/index.html': return self.serve_file('index.html')
        if path.startswith('/static/'): return self.serve_file(path[len('/static/'):])
        if path=='/api/config':
            with connection() as db:
                cycles=get_cycles(db)
            return self.send_json({'questions':QUESTIONS,'checklist':CHECKLIST,'cohorts':COHORTS,'dimensions':DIMENSIONS,'scale':SCALE,'cycles':cycles,'min_group':MIN_GROUP,'demo':True})
        if path=='/api/me': return self.send_json({'user':self.who()})
        if path=='/api/public/summary':
            with connection() as db:
                cycles=get_cycles(db)
                cid=int(query.get('cycle',[cycles[0]['id']])[0]) if cycles else 0
                snap=snapshot(db,cid)
            if not snap: return self.error('Оцінювання не знайдено',404)
            # Only overall combined safe-cohort numbers; never share group breakdown.
            return self.send_json({'cycle':snap['cycle'],'index':snap['index'],'level':snap['level'],'dimensions':[{'id':d['id'],'name':d['name'],'score':d['score']} for d in snap['dimensions']], 'respondents':snap['respondents']})
        if path.startswith('/api/'):
            user=self.require({'admin','leader','analyst','participant'})
            if not user: return
            if path=='/api/dashboard':
                if user['role']=='participant': return self.error('Недостатньо повноважень',403)
                with connection() as db:
                    cycles=get_cycles(db)
                    cid=int(query.get('cycle',[cycles[0]['id']])[0])
                    snaps=[snapshot(db,x['id']) for x in reversed(cycles)]
                    cur=snapshot(db,cid)
                if cur is None: return self.error('Немає циклу',404)
                return self.send_json({'current':cur,'history':[{'cycle':x['cycle'],'index':x['index']} for x in snaps], 'recommendations':recommend(cur)})
            if path=='/api/actions':
                if user['role']=='participant': return self.error('Недостатньо повноважень',403)
                with connection() as db:
                    return self.send_json({'items':rowdicts(db.execute('SELECT * FROM actions ORDER BY CASE status WHEN "in_progress" THEN 0 WHEN "accepted" THEN 1 ELSE 2 END, id DESC LIMIT 150'))})
            if path=='/api/evidence':
                if user['role']=='participant': return self.error('Недостатньо повноважень',403)
                with connection() as db:
                    cycles=get_cycles(db); cid=int(query.get('cycle',[cycles[0]['id']])[0]); records=rowdicts(db.execute('SELECT * FROM evidence WHERE cycle_id=?',(cid,)))
                return self.send_json({'items':records})
            if path=='/api/audit':
                if user['role'] not in ('admin','analyst'): return self.error('Недостатньо повноважень',403)
                with connection() as db:
                    return self.send_json({'items':rowdicts(db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 100'))})
            if path=='/api/report.json':
                if user['role']=='participant': return self.error('Недостатньо повноважень',403)
                with connection() as db:
                    cycles=get_cycles(db); cid=int(query.get('cycle',[cycles[0]['id']])[0]); snap=snapshot(db,cid)
                if not snap: return self.error('Немає циклу',404)
                return self.send_json({'assessment':snap,'recommendations':recommend(snap),'disclaimer':'Виключно синтетичні демонстраційні дані. Індекс не є офіційною методикою НАЗК.'},headers={'Content-Disposition':'attachment; filename="integrity-report.json"'})
            if path=='/api/report.csv':
                if user['role']=='participant': return self.error('Недостатньо повноважень',403)
                with connection() as db:
                    cycles=get_cycles(db); cid=int(query.get('cycle',[cycles[0]['id']])[0]); snap=snapshot(db,cid)
                if not snap: return self.error('Немає циклу',404)
                sio=io.StringIO(); w=csv.writer(sio,delimiter=';'); w.writerow(['Компонент','Самооцінювання','Чек-лист','Підсумок','Вага','Розбіжність'])
                for d in snap['dimensions']: w.writerow([d['name'],d['survey'],d['objective'],d['score'],d['weight'],d['gap']])
                w.writerow(['Integrity Index','','',snap['index'],'','']); w.writerow(['ДАНІ','СИНТЕТИЧНІ / ДЕМОНСТРАЦІЙНІ'])
                buf=('\ufeff'+sio.getvalue()).encode('utf-8')
                self.send_response(200); self.send_header('Content-Type','text/csv; charset=utf-8'); self.send_header('Content-Disposition','attachment; filename="integrity-report.csv"'); self.send_header('Content-Length',str(len(buf))); self.end_headers(); self.wfile.write(buf); return
            return self.error('Не знайдено',404)
        return self.error('Не знайдено',404)

    def do_POST(self):
        if not self.path.startswith('/api/'): return self.error('Не знайдено',404)
        if not self.safe_origin(): return self.error('Заборонене джерело запиту',403)
        data=self.read_json()
        if not isinstance(data,dict): return self.error('Некоректний JSON / занадто великий запит',400)
        path=urlparse(self.path).path
        if path=='/api/login':
            login=str(data.get('login',''))[:40]; password=str(data.get('password',''))
            with connection() as db:
                r=db.execute('SELECT * FROM users WHERE login=?',(login,)).fetchone()
                valid=r and secrets.compare_digest(salted_hash(password,r['salt']),r['password_hash'])
                if not valid: return self.error('Неправильний логін або пароль',401)
                user={'login':r['login'],'role':r['role']}
                audit(db,login,'session.login','Авторизація в демонстраційному середовищі')
            token=secrets.token_urlsafe(32)
            with SESSION_LOCK: SESSIONS[token]=user
            self.send_json({'user':user},headers={'Set-Cookie':f'integrity_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400'})
            return
        if path=='/api/logout':
            try:
                c=SimpleCookie(); c.load(self.headers.get('Cookie','')); token=c['integrity_session'].value
                with SESSION_LOCK: SESSIONS.pop(token,None)
            except: pass
            return self.send_json({'ok':True},headers={'Set-Cookie':'integrity_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})
        if path=='/api/survey':
            try:
                cycle_id=int(data['cycle_id']); cohort=str(data['cohort']); answers=data['answers']
                if cohort not in {c['id'] for c in COHORTS}: return self.error('Невідома категорія',400)
                if not isinstance(answers,dict) or set(answers)!={q['id'] for q in QUESTIONS}: return self.error('Заповніть усі питання',400)
                if any(type(v)!=int or not 0<=v<=4 for v in answers.values()): return self.error('Оцінки повинні бути від 0 до 4',400)
            except (KeyError,TypeError,ValueError): return self.error('Некоректні відповіді',400)
            with connection() as db:
                cycle=get_cycle(db,cycle_id)
                if not cycle or not cycle['is_open']: return self.error('Цикл оцінювання закрито',409)
                db.execute('BEGIN IMMEDIATE')
                db.execute('INSERT INTO cohort_totals(cycle_id,cohort,n) VALUES (?,?,1) ON CONFLICT(cycle_id,cohort) DO UPDATE SET n=n+1',(cycle_id,cohort))
                for q in QUESTIONS:
                    db.execute('INSERT INTO aggregate_answers(cycle_id,cohort,question_id,n,score_total) VALUES (?,?,?,?,?) ON CONFLICT(cycle_id,cohort,question_id) DO UPDATE SET n=n+1,score_total=score_total+excluded.score_total',(cycle_id,cohort,q['id'],1,answers[q['id']]))
                # Intentionally no respondent-level answers, IP or timestamp are written to SQLite.
            return self.send_json({'ok':True,'message':'Відповіді додано лише до анонімних агрегатів'},201)
        user=self.require({'admin','leader','analyst','participant'})
        if not user: return
        if path=='/api/evidence':
            if user['role'] not in ('admin','analyst'): return self.error('Недостатньо повноважень',403)
            try:
                cid=int(data['cycle_id']); qid=str(data['question_id']); score=int(data['score']); note=str(data.get('note',''))[:500]
                if qid not in {q['id'] for q in QUESTIONS} or score not in (0,50,100): raise ValueError
            except: return self.error('Некоректні індикатори',400)
            with connection() as db:
                if not get_cycle(db,cid): return self.error('Цикл не знайдено',404)
                db.execute('INSERT INTO evidence(cycle_id,question_id,score,note,changed_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(cycle_id,question_id) DO UPDATE SET score=excluded.score,note=excluded.note,changed_by=excluded.changed_by,updated_at=excluded.updated_at',(cid,qid,score,note,user['login'],now()))
                audit(db,user['login'],'evidence.update',f'Цикл {cid}; індикатор {qid}; {score}/100')
            return self.send_json({'ok':True})
        if path=='/api/actions':
            if user['role'] not in ('admin','leader'): return self.error('Недостатньо повноважень',403)
            try:
                cid=int(data['cycle_id']); dim=str(data['dimension']); title=str(data['title'])[:180]; description=str(data['description'])[:1500]; why=str(data['why'])[:400]; target=str(data.get('target',''))[:400]
                priority=str(data.get('priority','Помірний'))[:40]; owner=str(data.get('owner',''))[:120]; deadline=str(data.get('deadline',''))[:10]
                if dim not in {d['id'] for d in DIMENSIONS} or not title or not owner or not deadline: raise ValueError
                datetime.strptime(deadline,'%Y-%m-%d')
            except: return self.error('Потрібно вказати назву, виконавця та коректний строк',400)
            with connection() as db:
                if not get_cycle(db,cid): return self.error('Цикл не знайдено',404)
                rid=db.execute('INSERT INTO actions(cycle_id,dimension,title,description,why,target,priority,owner,deadline,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',(cid,dim,title,description,why,target,priority,owner,deadline,'accepted',now(),now())).lastrowid
                audit(db,user['login'],'action.accept',f'Рекомендація #{rid}; {dim}; призначено строк')
            return self.send_json({'ok':True,'id':rid},201)
        if path=='/api/actions/update':
            if user['role'] not in ('admin','leader'): return self.error('Недостатньо повноважень',403)
            try:
                rid=int(data['id']); status=str(data['status']); owner=str(data.get('owner',''))[:120]; deadline=str(data.get('deadline',''))[:10]
                if status not in ('accepted','in_progress','done','cancelled') or not owner or not deadline: raise ValueError
                datetime.strptime(deadline,'%Y-%m-%d')
            except: return self.error('Некоректне оновлення заходу',400)
            with connection() as db:
                if not db.execute('SELECT 1 FROM actions WHERE id=?',(rid,)).fetchone(): return self.error('Захід не знайдено',404)
                db.execute('UPDATE actions SET status=?,owner=?,deadline=?,updated_at=? WHERE id=?',(status,owner,deadline,now(),rid))
                audit(db,user['login'],'action.update',f'Захід #{rid}; новий статус {status}')
            return self.send_json({'ok':True})
        if path=='/api/cycles':
            if user['role']!='admin': return self.error('Недостатньо повноважень',403)
            title=str(data.get('title',''))[:140].strip(); period=str(data.get('period',''))[:80].strip()
            if not title or not period: return self.error('Вкажіть назву і період',400)
            with connection() as db:
                cid=db.execute('INSERT INTO cycles(title,period,is_open,created_at) VALUES (?,?,1,?)',(title,period,now())).lastrowid
                audit(db,user['login'],'cycle.create',f'Створено цикл #{cid}')
            return self.send_json({'ok':True,'id':cid},201)
        if path=='/api/cycles/toggle':
            if user['role']!='admin': return self.error('Недостатньо повноважень',403)
            try: cid=int(data['id']); is_open=int(bool(data['is_open']))
            except: return self.error('Некоректний цикл',400)
            with connection() as db:
                if not get_cycle(db,cid): return self.error('Цикл не знайдено',404)
                db.execute('UPDATE cycles SET is_open=? WHERE id=?',(is_open,cid))
                audit(db,user['login'],'cycle.toggle',f'Цикл #{cid}; відкрито={is_open}')
            return self.send_json({'ok':True})
        if path=='/api/demo/reset':
            if user['role']!='admin': return self.error('Недостатньо повноважень',403)
            reset(); return self.send_json({'ok':True})
        return self.error('Не знайдено',404)


def main():
    init()
    host=os.environ.get('INTEGRITY_HOST','127.0.0.1'); port=int(os.environ.get('PORT','8000'))
    print(f'IntegrityOS → http://{host}:{port}  | demo: admin / Demo2026!')
    ThreadingHTTPServer((host,port),Handler).serve_forever()

if __name__=='__main__': main()
