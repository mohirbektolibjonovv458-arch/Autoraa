import random

from django.core.management.base import BaseCommand
from django.db import transaction

from career.models import Career
from catalog.models import Grant, Program, University
from core.seed.careers import CAREERS
from core.seed.catalog import GRANTS, UNIVERSITIES
from core.seed.lessons import LESSONS
from core.seed.quizzes import QUIZZES
from learning.models import Lesson, Question, Quiz


def shuffled(q, rnd):
    """Seed ma'lumotlarida to'g'ri javob birinchi yozilgan — saqlashdan oldin variantlar aralashtiriladi."""
    opts = list(enumerate(q["options"]))
    rnd.shuffle(opts)
    return [o for _, o in opts], next(i for i, (orig, _) in enumerate(opts) if orig == q["correct_index"])


class Command(BaseCommand):
    help = "Boshlang'ich kontentni yuklaydi (kasblar, universitetlar, grantlar, testlar, darslar). Takror ishga tushirish xavfsiz: mavjud yozuvlar o'zgartirilmaydi."

    @transaction.atomic
    def handle(self, *args, **opts):
        rnd = random.Random(42)
        n = {"careers": 0, "universities": 0, "grants": 0, "quizzes": 0, "lessons": 0}
        for c in CAREERS:
            _, created = Career.objects.get_or_create(slug=c["slug"], defaults=c)
            n["careers"] += created
        for u in UNIVERSITIES:
            data = dict(u)
            programs = data.pop("programs")
            uni, created = University.objects.get_or_create(name=data["name"], defaults=data)
            if created:
                Program.objects.bulk_create([Program(university=uni, **p) for p in programs])
                n["universities"] += 1
        for g in GRANTS:
            _, created = Grant.objects.get_or_create(name=g["name"], defaults=g)
            n["grants"] += created
        for q in QUIZZES:
            data = dict(q)
            questions = data.pop("questions")
            quiz, created = Quiz.objects.get_or_create(title=data["title"], owner=None, defaults=data)
            if created:
                rows = []
                for i, item in enumerate(questions):
                    options, correct = shuffled(item, rnd)
                    rows.append(Question(quiz=quiz, text=item["text"], options=options, correct_index=correct,
                                         explanation=item["explanation"], topic=item["topic"], order=i))
                Question.objects.bulk_create(rows)
                n["quizzes"] += 1
        for l in LESSONS:
            data = dict(l)
            quiz_title = data.pop("quiz_title")
            if quiz_title:
                data["quiz"] = Quiz.objects.filter(title=quiz_title, owner=None).first()
            _, created = Lesson.objects.get_or_create(title=data["title"], defaults=data)
            n["lessons"] += created
        self.stdout.write(self.style.SUCCESS("Yuklandi: " + ", ".join(f"{k}: {v}" for k, v in n.items())))
