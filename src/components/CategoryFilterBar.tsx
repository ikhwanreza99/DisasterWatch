import React,{useEffect,useState} from 'react';
import {Flame,Waves,Activity,LayoutGrid,ListFilter,X,Mountain,TriangleAlert} from 'lucide-react';
import type {CategoryFilter,DisasterCategory} from '../types';
interface Props {mobile?:boolean;activeCategory:CategoryFilter;onSelectCategory:(category:CategoryFilter)=>void;isDarkMode:boolean;availableCategories?:DisasterCategory[]}
const choices=[{id:'all',label:'Semua bencana',Icon:LayoutGrid},{id:'fire',label:'Kebakaran',Icon:Flame},{id:'flood',label:'Banjir',Icon:Waves},{id:'earthquake',label:'Gempa',Icon:Activity},{id:'landslide',label:'Longsor',Icon:Mountain},{id:'other',label:'Bencana lainnya',Icon:TriangleAlert}] as const;
export const CategoryFilterBar:React.FC<Props>=({mobile=false,activeCategory,onSelectCategory,availableCategories=[]})=>{
 const [open,setOpen]=useState(false);
 const visible=choices.filter(c=>!['landslide','other'].includes(c.id)||availableCategories.includes(c.id as DisasterCategory));
 useEffect(()=>{if((activeCategory==='landslide'||activeCategory==='other')&&!availableCategories.includes(activeCategory))onSelectCategory('all');},[activeCategory,availableCategories,onSelectCategory]);
 const id=mobile?'mobile-disaster-options':'desktop-disaster-options';
 return <div className={mobile?'relative sm:hidden pointer-events-auto':'hidden sm:block absolute left-[84px] top-[72px] z-30 pointer-events-auto'} data-purpose={mobile?'mobile-category-filter':'category-filter-bar'}>
 <button type="button" aria-expanded={open} aria-controls={id} aria-label={open?'Minimalkan jenis bencana':'Buka jenis bencana'} onClick={()=>setOpen(!open)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-lg dark:bg-slate-900 dark:text-slate-100">
 {open?<X size={18}/>:<ListFilter size={18}/>}<span className="hidden sm:inline">{activeCategory==='all'?'Jenis bencana':choices.find(c=>c.id===activeCategory)?.label}</span></button>
 {open&&<div id={id} role="group" aria-label="Jenis bencana" className={`absolute top-[52px] ${mobile?'right-0':'left-0'} grid grid-cols-2 gap-1 w-[244px] max-w-[calc(100vw-96px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:bg-slate-900`}>
 {visible.map(({id:category,label,Icon})=><button key={category} type="button" aria-pressed={activeCategory===category} onClick={()=>{onSelectCategory(category);setOpen(false);}} className={`flex min-h-11 items-center gap-2 rounded-xl px-2 text-left text-[11px] ${activeCategory===category?'bg-slate-900 text-white dark:bg-cyan-700':'text-slate-600 hover:bg-slate-100 dark:text-slate-200'}`}><Icon size={18} className="shrink-0"/><span>{label}</span></button>)}
 </div>}
 </div>;
};
