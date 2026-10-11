import { BarChart3, Briefcase, Building2, Calculator, Code2, Cpu, FlaskConical, Globe2, GraduationCap, Heart, Home, Languages, Megaphone, Palette, PenTool, Pill, Rocket, Scale, Shield, Stethoscope, TrendingUp } from "lucide-react";

export const CAREER_ICONS: Record<string, any> = {
  code: Code2, chart: BarChart3, shield: Shield, palette: Palette, stethoscope: Stethoscope, pill: Pill, heart: Heart,
  building: Building2, cpu: Cpu, trending: TrendingUp, calculator: Calculator, megaphone: Megaphone, rocket: Rocket,
  scale: Scale, globe: Globe2, graduation: GraduationCap, pen: PenTool, languages: Languages, home: Home, flask: FlaskConical,
  briefcase: Briefcase,
};
export const careerIcon = (k: string) => CAREER_ICONS[k] || Briefcase;
