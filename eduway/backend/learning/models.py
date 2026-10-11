from django.conf import settings
from django.db import models

SUBJECTS = [
    ("math", "Matematika"), ("english", "Ingliz tili"), ("ielts", "IELTS"), ("physics", "Fizika"),
    ("chemistry", "Kimyo"), ("biology", "Biologiya"), ("informatics", "Informatika"), ("history", "Tarix"),
    ("logic", "Mantiq"),
]
LEVELS = [("A1", "A1"), ("A2", "A2"), ("B1", "B1"), ("B2", "B2"), ("C1", "C1"), ("C2", "C2"),
          ("easy", "Oson"), ("medium", "O'rta"), ("hard", "Qiyin")]


class Quiz(models.Model):
    title = models.CharField(max_length=160)
    subject = models.CharField(max_length=20, choices=SUBJECTS)
    topic = models.CharField(max_length=80, blank=True)
    level = models.CharField(max_length=6, choices=LEVELS, default="medium")
    description = models.TextField(blank=True)
    time_limit_seconds = models.PositiveIntegerField(null=True, blank=True)
    # generator bo'lsa savollar har urinishda yangidan yaratiladi; aks holda bazadan tasodifiy tanlanadi
    generator = models.CharField(max_length=20, blank=True)
    questions_per_attempt = models.PositiveSmallIntegerField(default=10)
    is_premium = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)
    # AI yaratgan shaxsiy testlar faqat egasiga ko'rinadi; umumiy testlarda owner bo'sh
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="own_quizzes")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["subject", "level", "id"]

    def __str__(self):
        return self.title


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    options = models.JSONField()  # ["a", "b", "c", "d"]
    correct_index = models.PositiveSmallIntegerField()
    explanation = models.TextField(blank=True)
    topic = models.CharField(max_length=80, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class Attempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    overtime = models.BooleanField(default=False)
    answers = models.JSONField(default=dict)

    class Meta:
        ordering = ["-started_at"]

    @property
    def percent(self):
        return round(100 * self.score / self.total) if self.total else 0


class Mistake(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mistakes")
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    times = models.PositiveSmallIntegerField(default=1)
    resolved = models.BooleanField(default=False)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "question")
        ordering = ["-updated"]


class Lesson(models.Model):
    SKILLS = [("grammar", "Grammar"), ("vocabulary", "Vocabulary"), ("reading", "Reading"), ("listening", "Listening"),
              ("writing", "Writing"), ("speaking", "Speaking"), ("ielts", "IELTS")]
    title = models.CharField(max_length=160)
    skill = models.CharField(max_length=12, choices=SKILLS)
    level = models.CharField(max_length=2, choices=LEVELS[:6])
    summary = models.CharField(max_length=300, blank=True)
    content = models.TextField()  # sodda markdown
    listening_text = models.TextField(blank=True)  # Listening: brauzer ovozi bilan o'qib beriladi
    quiz = models.ForeignKey(Quiz, null=True, blank=True, on_delete=models.SET_NULL)
    order = models.PositiveSmallIntegerField(default=0)
    is_premium = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ["level", "order", "id"]


class LessonProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "lesson")


class VocabWord(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vocab")
    word = models.CharField(max_length=80)
    translation = models.CharField(max_length=200)
    example = models.CharField(max_length=300, blank=True)
    ease = models.FloatField(default=2.5)
    interval_days = models.PositiveIntegerField(default=0)
    reps = models.PositiveIntegerField(default=0)
    lapses = models.PositiveIntegerField(default=0)
    due = models.DateField()
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "word")
        ordering = ["due", "id"]


class StudyGoal(models.Model):
    KINDS = [("ielts", "IELTS"), ("english", "Ingliz tili"), ("programming", "Dasturlash"), ("math", "Matematika"),
             ("university", "Universitetga kirish"), ("grant", "Grant yutish"), ("custom", "Boshqa")]
    STATUSES = [("active", "Faol"), ("done", "Bajarildi"), ("archived", "Arxiv")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="goals")
    title = models.CharField(max_length=160)
    kind = models.CharField(max_length=12, choices=KINDS, default="custom")
    target = models.CharField(max_length=160, blank=True)  # masalan "7.0"
    current_level = models.CharField(max_length=80, blank=True)
    deadline = models.DateField(null=True, blank=True)
    minutes_per_day = models.PositiveSmallIntegerField(default=30)
    status = models.CharField(max_length=10, choices=STATUSES, default="active")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["status", "-created"]


class StudyTask(models.Model):
    SOURCES = [("manual", "Qo'lda"), ("template", "Shablon"), ("ai", "AI")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tasks")
    goal = models.ForeignKey(StudyGoal, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    details = models.CharField(max_length=500, blank=True)
    date = models.DateField()
    minutes = models.PositiveSmallIntegerField(default=20)
    link = models.CharField(max_length=120, blank=True)  # ilova ichidagi yo'l
    source = models.CharField(max_length=10, choices=SOURCES, default="manual")
    done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["date", "done", "id"]


class FocusSession(models.Model):
    """Fokus taymer sessiyasi. Davomiylik server vaqti bo'yicha hisoblanadi (mijoz yuborgan raqamga ishonmaymiz)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="focus_sessions")
    label = models.CharField(max_length=120, blank=True)
    task = models.ForeignKey(StudyTask, null=True, blank=True, on_delete=models.SET_NULL)
    planned_minutes = models.PositiveSmallIntegerField()
    minutes = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]


class DailyChallenge(models.Model):
    """Kunlik challenge: savollar rejasi birinchi ochilganda yaratiladi va kun davomida o'zgarmaydi."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="challenges")
    date = models.DateField()
    plan = models.JSONField(default=list)
    completed = models.BooleanField(default=False)
    score = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    answers = models.JSONField(default=dict)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date"]
