"""SQLite persistence. No raw respondent-level survey submissions are ever stored."""
import hashlib
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timezone
from model import QUESTIONS, COHORTS, MIN_GROUP

BASE = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('INTEGRITY_DB', str(BASE/'data'/'integrityos.sqlite')))
DEMO_PASSWORD = 'Demo2026!'


def now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')

@contextmanager
def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA busy_timeout=15000')
    try:
        yield db
        db.commit()
    except:
        db.rollback()
        raise
    finally: db.close()

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, login TEXT UNIQUE NOT NULL, role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cycles(id INTEGER PRIMARY KEY, title TEXT NOT NULL, period TEXT NOT NULL, is_open INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cohort_totals(cycle_id INTEGER NOT NULL, cohort TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(cycle_id,cohort), FOREIGN KEY(cycle_id) REFERENCES cycles(id));
CREATE TABLE IF NOT EXISTS aggregate_answers(cycle_id INTEGER NOT NULL, cohort TEXT NOT NULL, question_id TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, score_total INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(cycle_id,cohort,question_id));
CREATE TABLE IF NOT EXISTS evidence(cycle_id INTEGER NOT NULL, question_id TEXT NOT NULL, score INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', changed_by TEXT NOT NULL DEFAULT 'demo', updated_at TEXT NOT NULL, PRIMARY KEY(cycle_id,question_id));
CREATE TABLE IF NOT EXISTS actions(id INTEGER PRIMARY KEY, cycle_id INTEGER NOT NULL, dimension TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, why TEXT NOT NULL, target TEXT NOT NULL, priority TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', deadline TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'accepted', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
"""


def salted_hash(password,salt):
    return hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),200_000).hex()


def add_user(db, login, role):
    salt=secrets.token_hex(16)
    db.execute('INSERT INTO users(login,role,salt,password_hash) VALUES (?,?,?,?)',(login,role,salt,salted_hash(DEMO_PASSWORD,salt)))


def seed(db):
    for login,role in [('admin','admin'),('analyst','analyst'),('leader','leader'),('participant','participant')]:
        add_user(db,login,role)
    past = db.execute('INSERT INTO cycles(title,period,is_open,created_at) VALUES (?,?,?,?)',('Весняне оцінювання','2026 · I півріччя',0,now())).lastrowid
    active = db.execute('INSERT INTO cycles(title,period,is_open,created_at) VALUES (?,?,?,?)',('Осіннє оцінювання','2026 · II півріччя',1,now())).lastrowid
    # Synthetic aggregated answers: distributed deterministically; no individual-level records persisted.
    cohort_bases = {'leadership':[3,3,3,3,2,3,3,2], 'personnel':[3,3,2,2,3,2,2,3], 'cadets':[3,2,2,2,2,1,2,2]}
    for cycle,shift in [(past,-1),(active,0)]:
        for cidx,cohort in enumerate(COHORTS):
            n = (11,14,16)[cidx]
            db.execute('INSERT INTO cohort_totals VALUES (?,?,?)',(cycle,cohort['id'],n))
            for qidx,q in enumerate(QUESTIONS):
                base = cohort_bases[cohort['id']][qidx]
                # Counts in adjacent levels; integer score totals.
                total = sum(max(0,min(4,base + shift + (1 if (i+qidx+cidx)%5==0 else 0))) for i in range(n))
                db.execute('INSERT INTO aggregate_answers VALUES (?,?,?,?,?)',(cycle,cohort['id'],q['id'],n,total))
        vals = ([50,50,50,50,50,50,50,50] if cycle==past else [100,100,50,50,100,50,0,50])
        for idx,q in enumerate(QUESTIONS):
            db.execute('INSERT INTO evidence VALUES (?,?,?,?,?,?)',(cycle,q['id'],vals[idx],'Штучне значення для демонстрації, не реальна перевірка','seed',now()))
    db.execute('INSERT INTO actions(cycle_id,dimension,title,description,why,target,priority,owner,deadline,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
               (past,'culture','Запровадити навчання з доброчесності','Пілотний цикл навчання','Демонстраційний приклад','Охоплено ≥ 80% персоналу','Високий','Робоча група','2026-10-15','done',now(),now()))
    audit(db,'system','demo.seed','Створено синтетичні цикли та агрегати')


def init():
    with connection() as db:
        db.executescript(SCHEMA)
        if not db.execute('SELECT 1 FROM users LIMIT 1').fetchone(): seed(db)


def reset():
    with connection() as db:
        for tbl in ['audit','actions','evidence','aggregate_answers','cohort_totals','cycles','users']:
            db.execute(f'DELETE FROM {tbl}')
        seed(db)


def audit(db, actor, action, detail):
    # Never write any survey answers, individual metadata or respondent identifiers.
    db.execute('INSERT INTO audit(at,actor,action,detail) VALUES (?,?,?,?)',(now(),actor,action,detail))


def get_cycles(db):
    return [dict(r) for r in db.execute('SELECT * FROM cycles ORDER BY id DESC')]


def get_cycle(db, cycle_id):
    row=db.execute('SELECT * FROM cycles WHERE id=?',(cycle_id,)).fetchone()
    return dict(row) if row else None


def snapshot(db, cycle_id):
    from model import compute
    cycle=get_cycle(db,cycle_id)
    if not cycle: return None
    counts = {r['cohort']:r['n'] for r in db.execute('SELECT cohort,n FROM cohort_totals WHERE cycle_id=?',(cycle_id,))}
    agg = {(r['cohort'],r['question_id']):(r['n'],r['score_total']) for r in db.execute('SELECT cohort,question_id,n,score_total FROM aggregate_answers WHERE cycle_id=?',(cycle_id,))}
    evidence = {r['question_id']:r['score'] for r in db.execute('SELECT question_id,score FROM evidence WHERE cycle_id=?',(cycle_id,))}
    return compute(cycle,counts,agg,evidence)
