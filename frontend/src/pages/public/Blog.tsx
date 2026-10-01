import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { api, media } from "../../api";
import { Logo, Spinner } from "../../components/ui";
import { shortDate } from "../../utils";

const CATS = [["", "Barchasi"], ["maslahat", "Maslahat"], ["yangilik", "Yangiliklar"], ["texnik", "Texnik xizmat"], ["qonun", "Qonunlar"]];

export default function Blog() {
  const { id } = useParams();
  const [cat, setCat] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const [post, setPost] = useState<any>(null);
  useEffect(() => {
    if (id) api.get(`/blog/${id}/`).then((r) => setPost(r.data));
    else api.get("/blog/", { params: { category: cat || undefined } }).then((r) => setItems(r.data));
  }, [id, cat]);

  return (
    <div className="landing">
      <nav className="pub-nav"><Link to="/"><Logo /></Link><div className="grow" /><Link to="/login" className="btn btn-red btn-sm">Kirish</Link></nav>
      <div className="pub-section" style={{ maxWidth: 860 }}>
        {id ? (!post ? <Spinner /> : (
          <article className="col gap-16">
            <Link to="/blog" style={{ color: "#8fb4ff" }} className="small">← Blogga qaytish</Link>
            <span className="badge dark" style={{ alignSelf: "flex-start", background: "#1f3152" }}>{post.category_label}</span>
            <h1 style={{ fontSize: 34 }}>{post.title}</h1>
            <p className="small row gap-4" style={{ color: "#8e9bb2" }}><CalendarDays size={14} />{shortDate(post.created_at)}</p>
            {post.image && <img src={media(post.image)} style={{ borderRadius: 18 }} alt="" />}
            {post.body.split("\n").filter(Boolean).map((p: string, i: number) => <p key={i} style={{ color: "#c6d0e0", lineHeight: 1.7 }}>{p}</p>)}
          </article>
        )) : (
          <>
            <h1 style={{ fontSize: 34 }}>Blog va yangiliklar</h1>
            <p style={{ color: "#8e9bb2" }} className="mt-8">Avto dunyodagi eng so'nggi yangiliklar, maslahatlar va foydali maqolalar</p>
            <div className="chips mt-16">{CATS.map(([k, v]) => <button key={k} className={"chip" + (cat === k ? " active" : "")} style={cat === k ? { background: "#ee2b2f", borderColor: "#ee2b2f" } : { background: "#111f36", color: "#c6d0e0", borderColor: "#1f3152" }} onClick={() => setCat(k)}>{v}</button>)}</div>
            {!items ? <Spinner /> : (
              <div className="col gap-12 mt-16">
                {items.map((p) => (
                  <Link key={p.id} to={`/blog/${p.id}`} className="role-card">
                    <div className="row gap-8"><span className="badge dark" style={{ background: "#1f3152" }}>{p.category_label}</span><span className="xs" style={{ color: "#7d8aa3" }}>{shortDate(p.created_at)}</span></div>
                    <h3 style={{ fontSize: 18 }}>{p.title}</h3>
                    <p className="small" style={{ color: "#8e9bb2" }}>{p.excerpt}</p>
                  </Link>
                ))}
                {items.length === 0 && <p style={{ color: "#8e9bb2" }}>Hozircha maqolalar yo'q.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
