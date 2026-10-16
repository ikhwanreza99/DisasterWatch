import React,{useEffect,useState} from 'react';
import {Flame,Waves,Activity,LayoutGrid,ListFilter,X,Mountain,TriangleAlert} from 'lucide-react';
import type {CategoryFilter,DisasterCategory} from '../types';
import {useI18n} from '../i18n';
interface Props {mobile?:boolean;activeCategory:CategoryFilter;onSelectCategory:(category:CategoryFilter)=>void;isDarkMode:boolean;availableCategories?:DisasterCategory[]}
const choices=[{id:'all',label:'Semua bencana',Icon:LayoutGrid},{id:'fire',label:'Kebakaran',Icon:Flame},{id:'flood',label:'Banjir',Icon:Waves},{id:'earthquake',label:'Gempa',Icon:Activity},{id:'landslide',label:'Longsor',Icon:Mountain},{id:'other',label:'Bencana lainnya',Icon:TriangleAlert}] as const;
export const CategoryFilterBar:React.FC<Props>=({mobile=false,activeCategory,onSelectCategory,availableCategories=[]})=>{
 const {t}=useI18n();
 const [desktop,setDesktop]=useState(false);
 const [open,setOpen]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(min-width:1024px) and (min-height:561px)');const update=()=>{setDesktop(!mobile&&media.matches);setOpen(!mobile&&media.matches);};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[mobile]);
 const visible=choices.filter(c=>!['landslide','other'].includes(c.id)||availableCategories.includes(c.id as DisasterCategory));
 useEffect(()=>{if((activeCategory==='landslide'||activeCategory==='other')&&!availableCategories.includes(activeCategory))onSelectCategory('all');},[activeCategory,availableCategories,onSelectCategory]);
 if(desktop)return <div role="group" aria-label={t('Jenis bencana')} data-purpose="category-filter-bar" className="absolute left-6 top-16 z-30 flex flex-col gap-2.5 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 pointer-events-auto">
 {visible.map(({id:category,label,Icon})=><button key={category} type="button" title={t(label)} aria-label={t(label)} aria-pressed={activeCategory===category} onClick={()=>onSelectCategory(category)} className={`group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${activeCategory===category?(category==='fire'?'bg-amber-500 border-amber-400 text-white':category==='flood'?'bg-blue-600 border-blue-400 text-white':category==='earthquake'?'bg-rose-600 border-rose-400 text-white':'bg-slate-900 border-slate-900 text-white'):'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
 <Icon size={20}/><span className="pointer-events-none absolute left-16 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white opacity-0 shadow-md group-hover:opacity-100 group-focus-visible:opacity-100">{t(label)}</span></button>)}
 </div>;
 const id=mobile?'mobile-disaster-options':'desktop-disaster-options';
 return <div className={mobile?'relative sm:hidden pointer-events-auto':'hidden sm:block absolute left-[140px] top-4 z-40 pointer-events-auto'} data-purpose={mobile?'mobile-category-filter':'category-filter-bar'}>
 <button type="button" aria-expanded={open} aria-controls={id} aria-label={open?t('Minimalkan jenis bencana'):t('Buka jenis bencana')} onClick={()=>setOpen(!open)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-lg dark:bg-slate-900 dark:text-slate-100">
 {open?<X size={18}/>:<ListFilter size={18}/>}<span className="hidden sm:inline">{activeCategory==='all'?t('Jenis bencana'):t(choices.find(c=>c.id===activeCategory)?.label??'')}</span></button>
 {open&&<div id={id} role="group" aria-label={t('Jenis bencana')} className={`absolute top-[52px] ${mobile?'right-0':'left-0'} grid grid-cols-2 gap-1 w-[244px] max-w-[calc(100vw-96px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:bg-slate-900`}>
 {visible.map(({id:category,label,Icon})=><button key={category} type="button" aria-pressed={activeCategory===category} onClick={()=>{onSelectCategory(category);if(!desktop)setOpen(false);}} className={`flex min-h-11 items-center gap-2 rounded-xl px-2 text-left text-[11px] ${activeCategory===category?'bg-slate-900 text-white dark:bg-cyan-700':'text-slate-600 hover:bg-slate-100 dark:text-slate-200'}`}><Icon size={18} className="shrink-0"/><span>{t(label)}</span></button>)}
 </div>}
 </div>;
};
