"""IntegrityOS demonstrative assessment model.
Adapted from 2025 NUOU Recommendations, Annex B and V (not an official index).
"""
from __future__ import annotations

DIMENSIONS = [
    {"id": "culture", "name": "Культура", "weight": .30, "short": "Етичні принципи й лідерство", "color": "#50cfa8"},
    {"id": "system", "name": "Система", "weight": .25, "short": "Процедури та інституційна спроможність", "color": "#6aaaff"},
    {"id": "accountability", "name": "Підзвітність", "weight": .30, "short": "Управління ризиками й контролем", "color": "#ffbc70"},
    {"id": "maturity", "name": "Зрілість", "weight": .15, "short": "Регулярний розвиток і вдосконалення", "color": "#bb9dff"},
]

QUESTIONS = [
    {"id": "leadership", "dimension": "culture", "title": "Наскільки керівництво особисто залучене до розвитку доброчесності?", "hint": "Від відсутності уваги — до вимірюваних цілей і підтримки інновацій.", "source": "Додаток В, розділ 1, питання 1"},
    {"id": "ethics", "dimension": "culture", "title": "Наскільки реально працюють етичні норми та цінності установи?", "hint": "Від відсутності кодексу — до постійного вдосконалення практики.", "source": "Додаток В, розділ 1, питання 2"},
    {"id": "training", "dimension": "culture", "title": "Наскільки системно проводиться навчання з питань доброчесності?", "hint": "Від несистемних заходів — до навчання за потребами й перевірки ефективності.", "source": "Додаток В, розділ 1, питання 3"},
    {"id": "compliance", "dimension": "system", "title": "Наскільки спроможно працює антикорупційний уповноважений?", "hint": "Повноваження, ресурси, незалежність, координація та професійний розвиток.", "source": "Додаток В, розділ 2, питання 1"},
    {"id": "strategy", "dimension": "system", "title": "Наскільки впроваджено стратегію і внутрішні політики доброчесності?", "hint": "Від реактивних рішень — до регулярного перегляду правил на основі даних.", "source": "Додаток В, розділ 2, питання 2"},
    {"id": "risks", "dimension": "accountability", "title": "Наскільки системно виявляють і мінімізують корупційні ризики?", "hint": "Реєстр, відповідальні особи, контроль виконання та перегляд ризиків.", "source": "Додаток В, розділ 3, питання 1"},
    {"id": "whistle", "dimension": "accountability", "title": "Наскільки дієві канали повідомлень про порушення та захист викривачів?", "hint": "Доступність повідомлень, правила реагування й захист від переслідування.", "source": "Додаток В, розділ 3, питання 3"},
    {"id": "progress", "dimension": "maturity", "title": "На якому рівні зрілості перебуває система доброчесності установи?", "hint": "Від хаотичних дій — до вимірюваного розвитку й постійного вдосконалення.", "source": "Додаток В, розділ 4"},
]

# Explicit illustrative crosswalk. Checklist entries refer to concrete items of Annex B;
# they are not claimed to be identical to the (shortened) Annex V survey questions.
CHECKLIST = {
    "leadership": {"source":"Додаток Б, п. 1.3", "title":"Затверджена програма доброчесності та участь керівництва"},
    "ethics": {"source":"Додаток Б, п. 1.2", "title":"Цінності доброчесності визначені в установчих документах"},
    "training": {"source":"Додаток Б, п. 2.6", "title":"План регулярних навчальних заходів з доброчесності"},
    "compliance": {"source":"Додаток Б, п. 2.1", "title":"Визначений організаційно-правовий статус уповноваженого"},
    "strategy": {"source":"Додаток Б, п. 1.1", "title":"Затверджений план заходів з трансформації доброчесності"},
    "risks": {"source":"Додаток Б, п. 4.1.1", "title":"Впроваджені правила запобігання та врегулювання конфлікту інтересів"},
    "whistle": {"source":"Додаток Б, п. 2.7", "title":"Працюють канали повідомлень та захист викривачів"},
    "progress": {"source":"Додаток Б, п. 1.1", "title":"Визначено рівень зрілості та заходи її підвищення"},
}

COHORTS = [
    {"id": "leadership", "name": "Керівний склад"},
    {"id": "personnel", "name": "Науково-педагогічний і цивільний персонал"},
    {"id": "cadets", "name": "Курсанти / здобувачі освіти"},
]

SCALE = [
    "0 · Відсутньо / хаотично",
    "1 · Початкові окремі заходи",
    "2 · Визначено та впроваджується",
    "3 · Системно вимірюється",
    "4 · Постійно вдосконалюється",
]

RECOMMENDATIONS = {
    "culture": ("Посилити культуру доброчесності", "Затвердити календар навчань, комунікацій керівництва та опитувань зворотного зв'язку.", "Проведено щонайменше 2 заходи та виміряно охоплення персоналу."),
    "system": ("Оновити інституційні механізми", "Перевірити повноваження уповноваженого, актуалізувати політики та довести їх до підрозділів.", "Політики оновлено, проведено перевірку ознайомлення."),
    "accountability": ("Покращити підзвітність і ризик-менеджмент", "Оновити реєстр корупційних ризиків, перевірити канали повідомлень та аудит виконання заходів.", "Ризики мають власників, строки та документовані результати моніторингу."),
    "maturity": ("Запровадити цикл постійного вдосконалення", "Щоквартально аналізувати показники, затверджувати дії та перевіряти їх ефект наступним оцінюванням.", "Зафіксовано повторний вимір та зміну показників за компонентами."),
}

MIN_GROUP = 5


def level(value):
    if value is None: return "Недостатньо даних"
    return ["Початковий", "Формується", "Визначений", "Керований", "Оптимізований"][min(4, int(value // 20))]


def round1(value):
    return round(float(value), 1) if value is not None else None


def compute(cycle, cohort_counts, answers, objective, min_group=MIN_GROUP):
    """Answers are aggregate counts/sums only; unsafe small cohorts are excluded entirely."""
    safe_cohorts = {k for k,n in cohort_counts.items() if n >= min_group}
    by_question = {}
    for question in QUESTIONS:
        qid = question["id"]
        pairs = [answers.get((group, qid), (0,0)) for group in safe_cohorts]
        count = sum(p[0] for p in pairs)
        value = (sum(p[1] for p in pairs)/count)*25 if count else None
        by_question[qid] = round1(value)
    dimensions = []
    for d in DIMENSIONS:
        qs = [q for q in QUESTIONS if q['dimension'] == d['id']]
        survey = [by_question[q['id']] for q in qs]
        valid = [x for x in survey if x is not None]
        survey_avg = sum(valid)/len(valid) if len(valid) == len(survey) else None
        objs = [objective.get(q['id'], None) for q in qs]
        obj_valid = [x for x in objs if x is not None]
        obj_avg = sum(obj_valid)/len(obj_valid) if len(obj_valid) == len(objs) else None
        # Evidence is not substituted for anonymous opinion; all components require valid sample.
        score = .7*survey_avg + .3*obj_avg if survey_avg is not None and obj_avg is not None else None
        dimensions.append({**d, "survey": round1(survey_avg), "objective": round1(obj_avg), "score": round1(score), "gap": round1(survey_avg-obj_avg) if survey_avg is not None and obj_avg is not None else None, "level": level(score)})
    scores_available = all(d['score'] is not None for d in dimensions)
    integrity_index = round1(sum(d['score']*d['weight'] for d in dimensions)) if scores_available else None
    groups = []
    for g in COHORTS:
        count = cohort_counts.get(g['id'],0)
        safe = count >= min_group
        gr = {}
        if safe:
            for d in DIMENSIONS:
                qids = [q['id'] for q in QUESTIONS if q['dimension'] == d['id']]
                vals = []
                for qid in qids:
                    n,total = answers.get((g['id'],qid),(0,0))
                    if n: vals.append(total/n * 25)
                gr[d['id']] = round1(sum(vals)/len(vals)) if len(vals)==len(qids) else None
        groups.append({"id": g['id'], "name": g['name'], "suppressed": not safe, "count": count if safe else None, "dimensions": gr})
    alerts = []
    for d in dimensions:
        if d['gap'] is not None and abs(d['gap']) >= 20:
            alerts.append({"component": d['id'], "label": d['name'], "severity": "high" if abs(d['gap'])>=30 else "medium", "gap": d['gap'], "text": "Самооцінка вища за підтверджені індикатори" if d['gap']>0 else "Підтверджені індикатори вищі за самооцінку"})
    return {
        "cycle": cycle,
        "index": integrity_index,
        "level": level(integrity_index),
        "respondents": sum(cohort_counts[k] for k in safe_cohorts),
        "suppressed_groups": sum(1 for k,n in cohort_counts.items() if n < min_group),
        "dimensions": dimensions, "groups": groups,
        "question_scores": by_question,
        "alerts": alerts,
        "method": {"weights": {d['id']: d['weight'] for d in DIMENSIONS}, "survey_weight": .7, "objective_weight": .3, "min_group": min_group, "scale": "0–4 → 0–100", "official": False},
    }


def recommend(assessment):
    result = []
    for d in assessment['dimensions']:
        if d['score'] is None: continue
        reasons = []
        if d['score'] < 70: reasons.append(f"рівень компонента {d['score']} / 100")
        if d['gap'] is not None and abs(d['gap']) >= 20: reasons.append(f"розбіжність оцінювання та індикаторів {abs(d['gap'])} п.")
        if not reasons: continue
        name, desc, target = RECOMMENDATIONS[d['id']]
        priority = "Критичний" if d['score']<45 or (d['gap'] is not None and abs(d['gap'])>=30) else "Високий" if d['score']<60 else "Помірний"
        result.append({"dimension": d['id'], "title": name, "description": desc, "target": target, "why": "; ".join(reasons), "priority": priority, "rule": "score < 70 АБО |survey − evidence| ≥ 20; без ШІ"})
    return result
