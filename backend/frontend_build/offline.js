// offline.html uchun (CSP inline skriptlarga ruxsat bermaydi)
document.getElementById("retry").addEventListener("click", function () { location.reload(); });
window.addEventListener("online", function () { location.reload(); });
