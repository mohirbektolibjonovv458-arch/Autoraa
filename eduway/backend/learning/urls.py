from django.urls import path

from . import english_views as e, extra_views as x, plan_views as p, quiz_views as q, stats_views as s

urlpatterns = [
    path("quizzes/", q.quiz_list),
    path("quizzes/<int:pk>/start/", q.quiz_start),
    path("attempts/", q.attempt_history),
    path("attempts/<int:pk>/submit/", q.quiz_submit),
    path("mistakes/", q.mistakes),
    path("mistakes/submit/", q.mistakes_submit),
    path("lessons/", e.lessons),
    path("lessons/<int:pk>/", e.lesson_detail),
    path("lessons/<int:pk>/complete/", e.lesson_complete),
    path("english/", e.english_overview),
    path("vocab/", e.vocab),
    path("vocab/<int:pk>/", e.vocab_item),
    path("vocab/<int:pk>/review/", e.vocab_review),
    path("goals/", p.goals),
    path("goals/<int:pk>/", p.goal_item),
    path("goals/<int:pk>/generate/", p.goal_generate),
    path("tasks/", p.tasks),
    path("tasks/<int:pk>/", p.task_item),
    path("stats/", s.stats),
    path("focus/", x.focus_overview),
    path("focus/start/", x.focus_start),
    path("focus/<int:pk>/finish/", x.focus_finish),
    path("focus/<int:pk>/cancel/", x.focus_cancel),
    path("challenge/", x.challenge),
    path("challenge/submit/", x.challenge_submit),
    path("placement/", x.placement_test),
    path("placement/submit/", x.placement_submit),
]
