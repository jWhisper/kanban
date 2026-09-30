import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import heroImage from '../assets/creator-hero.png';

export function DeskHero({ onResearch }: { onResearch: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [hours, minutes, seconds] = now.toLocaleTimeString('zh-CN', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(':');
  return <section className="cw-desk-hero" aria-label="今日时钟">
    <img className="cw-hero-art" src={heroImage} alt="" aria-hidden="true" />
    <div className="cw-hero-shade" />
    <div className="cw-hero-content">
      <p className="cw-hero-kicker"><span />留一点时间，给好想法</p>
      <time className="cw-hero-clock" dateTime={now.toISOString()} aria-label={`本地时间 ${hours}点${minutes}分${seconds}秒`}><span>{hours}<span className="cw-clock-colon">:</span>{minutes}</span><small>{seconds}</small></time>
      <p className="cw-hero-date">{now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}<span>本地时间</span></p>
      <button className="cw-hero-action" onClick={onResearch}><Sparkles size={15} />发现今天的灵感<ArrowUpRight size={15} /></button>
    </div>
    <div className="cw-hero-caption" aria-hidden="true"><span>THE DAILY CANVAS</span><p>有迹可循，自在创作。</p></div>
  </section>;
}
