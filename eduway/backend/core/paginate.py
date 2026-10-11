from rest_framework.pagination import PageNumberPagination


class Pager(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def paginate(request, qs, serializer_cls, context=None):
    pager = Pager()
    page = pager.paginate_queryset(qs, request)
    ctx = {"request": request, **(context or {})}
    return pager.get_paginated_response(serializer_cls(page, many=True, context=ctx).data)
