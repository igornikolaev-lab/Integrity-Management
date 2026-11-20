"""Run: python -m unittest discover -s tests -v"""
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from http.cookiejar import CookieJar
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import store
from server import Handler
from model import QUESTIONS,COHORTS,CHECKLIST,MIN_GROUP,compute,recommend,DIMENSIONS

class IntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        store.DB_PATH=Path(cls.tmp.name)/'test.sqlite'
        store.init()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.url=f'http://127.0.0.1:{cls.server.server_address[1]}'
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()

    def client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    def call(self,client,path,data=None):
        body=json.dumps(data,ensure_ascii=False).encode() if data is not None else None
        req=urllib.request.Request(self.url+path,body,headers={'Content-Type':'application/json'},method='POST' if data is not None else 'GET')
        try:
            with client.open(req,timeout=5) as response:
                payload=response.read()
                try:return response.status,json.loads(payload)
                except:return response.status,payload.decode('utf-8-sig')
        except urllib.error.HTTPError as e:
            try:return e.code,json.loads(e.read())
            except:return e.code,None
    def auth(self,role):
        op=self.client()
        code,resp=self.call(op,'/api/login',{'login':role,'password':store.DEMO_PASSWORD})
        self.assertEqual(code,200)
        return op

    def test_01_model_and_privacy(self):
        with store.connection() as db:
            s=store.snapshot(db,2)
            self.assertIsNotNone(s['index'])
            self.assertEqual(s['respondents'],41)
            self.assertAlmostEqual(sum(d['weight'] for d in DIMENSIONS),1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='raw_responses'").fetchone()[0],0)
            self.assertTrue(recommend(s))
        # One too-small cohort never enters overall aggregates and its count is suppressed.
        fake={( 'cadets',q['id']):(4,0) for q in QUESTIONS}
        fake.update({('leadership',q['id']):(5,20) for q in QUESTIONS})
        s2=compute({'id':100},{'leadership':5,'cadets':4},fake,{q['id']:100 for q in QUESTIONS})
        self.assertEqual(s2['respondents'],5)
        self.assertIsNone(next(g for g in s2['groups'] if g['id']=='cadets')['count'])
        self.assertEqual(s2['index'],100)

    def test_02_public_no_group_exposure(self):
        op=self.client()
        code,data=self.call(op,'/api/public/summary?cycle=2')
        self.assertEqual(code,200)
        self.assertNotIn('groups',data)
        self.assertNotIn('question_scores',data)
        self.assertEqual(data['respondents'],41)
        code,err=self.call(op,'/api/dashboard?cycle=2')
        self.assertEqual(code,401)

    def test_03_roles_and_export(self):
        person=self.auth('participant')
        self.assertEqual(self.call(person,'/api/dashboard')[0],403)
        self.assertEqual(self.call(person,'/api/report.csv')[0],403)
        leader=self.auth('leader')
        self.assertEqual(self.call(leader,'/api/dashboard?cycle=2')[0],200)
        self.assertEqual(self.call(leader,'/api/evidence',{'cycle_id':2,'question_id':'ethics','score':100})[0],403)
        self.assertEqual(self.call(leader,'/api/report.json?cycle=2')[0],200)
        self.assertEqual(self.call(leader,'/api/report.csv?cycle=2')[0],200)

    def test_04_institutional_evidence_and_recommendation(self):
        op=self.auth('analyst')
        original=self.call(op,'/api/dashboard?cycle=2')[1]['current']['index']
        code,_=self.call(op,'/api/evidence',{'cycle_id':2,'question_id':'whistle','score':100,'note':'Штучне підтвердження'})
        self.assertEqual(code,200)
        updated=self.call(op,'/api/dashboard?cycle=2')[1]['current']['index']
        self.assertGreater(updated,original)
        self.assertEqual(self.call(op,'/api/actions',{'cycle_id':2,'dimension':'system','title':'a','description':'b','why':'c','target':'d','owner':'team','deadline':'2026-12-01'})[0],403)
        adm=self.auth('admin')
        code,data=self.call(adm,'/api/actions',{'cycle_id':2,'dimension':'accountability','title':'Навчальний захід','description':'Тест','why':'Індекс низький','target':'Перевірка','priority':'Високий','owner':'Робоча група','deadline':'2027-01-15'})
        self.assertEqual(code,201)
        aid=data['id']
        self.assertEqual(self.call(adm,'/api/actions/update',{'id':aid,'status':'in_progress','owner':'Робоча група','deadline':'2027-01-15'})[0],200)
        events=self.call(adm,'/api/audit')[1]['items']
        self.assertTrue(any(e['action']=='action.update' for e in events))

    def test_05_anonymous_submission_is_aggregated(self):
        op=self.client()
        with store.connection() as db:
            before=db.execute("SELECT n FROM cohort_totals WHERE cycle_id=2 AND cohort='cadets'").fetchone()['n']
        answers={q['id']:2 for q in QUESTIONS}
        code,_=self.call(op,'/api/survey',{'cycle_id':2,'cohort':'cadets','answers':answers})
        self.assertEqual(code,201)
        with store.connection() as db:
            after=db.execute("SELECT n FROM cohort_totals WHERE cycle_id=2 AND cohort='cadets'").fetchone()['n']
            self.assertEqual(after,before+1)
            tables={r['name'] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertNotIn('responses',tables)
            audit_rows=[dict(r) for r in db.execute('SELECT * FROM audit')]
            self.assertFalse(any(x['action']=='survey.submission' for x in audit_rows))
        code,_=self.call(op,'/api/survey',{'cycle_id':2,'cohort':'cadets','answers':{**answers,'risks':-1}})
        self.assertEqual(code,400)

    def test_06_create_cycle_and_block_empty_index(self):
        adm=self.auth('admin')
        code,res=self.call(adm,'/api/cycles',{'title':'Новий цикл','period':'2027 · I півріччя'})
        self.assertEqual(code,201)
        current=self.call(adm,f"/api/dashboard?cycle={res['id']}")[1]['current']
        self.assertIsNone(current['index'])
        self.assertIsNone(current['dimensions'][0]['score'])
        self.assertEqual(self.call(adm,'/api/cycles/toggle',{'id':res['id'],'is_open':False})[0],200)
        self.assertEqual(self.call(self.client(),'/api/survey',{'cycle_id':res['id'],'cohort':'cadets','answers':{q['id']:1 for q in QUESTIONS}})[0],409)

if __name__=='__main__':unittest.main()
