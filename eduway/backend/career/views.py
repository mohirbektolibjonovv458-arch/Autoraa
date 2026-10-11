from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.progress import XP, award, notify, record

from .models import Career, CareerResult, SavedCareer
from .scoring import InvalidAnswers, dimension_scores, match_careers, validate
from .test_data import DIMENSIONS, public_test


class CareerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Career
        fields = "__all__"


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareerResult
        fields = ["id", "scores", "matches", "ai_advice", "created"]


@api_view(["GET"])
def test(request):
    return Response(public_test())


@api_view(["POST"])
def submit(request):
    try:
        answers = validate(request.data)
    except InvalidAnswers as e:
        return Response({"detail": str(e)}, status=400)
    scores = dimension_scores(answers)
    matches = match_careers(scores, answers, Career.objects.filter(is_published=True), request.user.interests)
    res = CareerResult.objects.create(user=request.user, answers=answers, scores=scores, matches=matches)
    if answers["subjects"] and not request.user.favorite_subjects:
        request.user.favorite_subjects = answers["subjects"]
        request.user.save(update_fields=["favorite_subjects"])
    first = award(request.user, "career_explorer")
    record(request.user, "career_test", xp=XP["career_test"] if first else 5)
    if matches:
        notify(request.user, "Kasb testi natijasi tayyor", f"Eng mos yo'nalish: {matches[0]['title']}", f"/career/result/{res.id}", "career")
    return Response({**ResultSerializer(res).data, "dimensions": DIMENSIONS}, status=201)


@api_view(["GET"])
def results(request):
    qs = CareerResult.objects.filter(user=request.user)[:20]
    return Response(ResultSerializer(qs, many=True).data)


@api_view(["GET"])
def result_detail(request, pk):
    r = get_object_or_404(CareerResult, pk=pk, user=request.user)
    return Response({**ResultSerializer(r).data, "dimensions": DIMENSIONS})


@api_view(["GET"])
def careers(request):
    qs = Career.objects.filter(is_published=True)
    saved = set(SavedCareer.objects.filter(user=request.user).values_list("career_id", flat=True))
    return Response([{**CareerSerializer(c).data, "saved": c.id in saved} for c in qs])


@api_view(["GET"])
def career_detail(request, slug):
    c = get_object_or_404(Career, slug=slug, is_published=True)
    from catalog.models import University

    unis = University.objects.filter(is_published=True, programs__field=c.field).distinct()[:8]
    return Response({
        **CareerSerializer(c).data,
        "saved": SavedCareer.objects.filter(user=request.user, career=c).exists(),
        "dimensions": {code: DIMENSIONS[code] for code in c.riasec},
        "universities": [{"id": u.id, "name": u.name, "city": u.city, "country": u.country} for u in unis],
    })


@api_view(["POST", "DELETE"])
def career_save(request, slug):
    c = get_object_or_404(Career, slug=slug, is_published=True)
    if request.method == "POST":
        SavedCareer.objects.get_or_create(user=request.user, career=c)
        return Response({"saved": True})
    SavedCareer.objects.filter(user=request.user, career=c).delete()
    return Response({"saved": False})
