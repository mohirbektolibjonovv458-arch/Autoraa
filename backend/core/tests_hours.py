from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from core.hours import is_open

TZ = ZoneInfo("Asia/Tashkent")
at = lambda d, h, m=0: datetime(2026, 9, 28, h, m, tzinfo=TZ) + timedelta(days=d)  # 28-sentabr 2026 — dushanba


class HoursTests(SimpleTestCase):
    def test_cases(self):
        self.assertTrue(is_open("24/7", at(0, 3)))
        self.assertTrue(is_open("08:00 - 20:00", at(0, 9)))
        self.assertFalse(is_open("08:00 - 20:00", at(0, 20, 1)))
        self.assertTrue(is_open("Mo-Fr 08:00-18:00; Sa 09:00-14:00; Su off", at(5, 10)))   # shanba
        self.assertFalse(is_open("Mo-Fr 08:00-18:00; Sa 09:00-14:00; Su off", at(6, 10)))  # yakshanba
        self.assertFalse(is_open("Mo-Sa 08:00-12:00,13:00-18:00", at(0, 12, 30)))          # tushlik
        self.assertTrue(is_open("20:00-06:00", at(1, 2)))                                    # tungi
        self.assertIsNone(is_open("har kuni ertalabdan", at(0, 9)))                          # noma'lum
        self.assertFalse(is_open("08:00-20:00", at(6, 10), days_allowed={0, 1, 2, 3, 4, 5}))  # usta yakshanba ishlamaydi
        self.assertTrue(is_open("", at(0, 3), is_24_7=True))
