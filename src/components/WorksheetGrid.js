import React, {useLayoutEffect,useMemo,useRef,useState} from 'react';

function columnName(index) {
  let result='';
  while(index>0) {
    index--;
    result=String.fromCharCode(65+index%26)+result;
    index=Math.floor(index/26);
  }
  return result;
}
function offsets(count, size) {
  const result=[0];
  for(let i=1;i<=count;i++) result.push(result[i-1]+Math.max(0,size(i)));
  return result;
}
function visible(axis, start, length) {
  let low=1, high=axis.length;
  while(low<high) {
    const middle=Math.floor((low+high)/2);
    if(axis[middle]<=start) low=middle+1;
    else high=middle;
  }
  const indices=[];
  for(let i=low;i<axis.length && axis[i-1]<start+length;i++) if(axis[i]>axis[i-1]) indices.push(i);
  return indices;
}
function layout(sheet) {
  const cells=new Map(), heights=new Map();
  let rows=35,cols=16;
  const include=({row,col})=>{rows=Math.max(rows,row);cols=Math.max(cols,col);};
  sheet.cells.forEach(cell=>{cells.set(cell.address,cell);include(cell);});
  sheet.rows.forEach(r=>{heights.set(r.row,r.height);rows=Math.max(rows,r.row);});
  sheet.merges.forEach(m=>include(m.end));
  sheet.images.forEach(i=>include(i.to || i.from));
  // Each axis uses cumulative pixels so hidden rows and columns occupy no space.
  const y=offsets(rows,i=>heights.get(i) ?? sheet.defaultHeight);
  const widths=Array(cols+1).fill(sheet.defaultWidth);
  sheet.columns.forEach(c=>widths.fill(c.width,c.min,Math.min(cols,c.max)+1));
  return {cells,x:offsets(cols,i=>widths[i]),y};
}
const inside=(range,r,c)=>range.start.row<=r && range.end.row>=r && range.start.col<=c && range.end.col>=c;

export default function WorksheetGrid({sheet,changes,onChange,busy}) {
  const pane=useRef(null),input=useRef(null);
  const [active,setActive]=useState('');
  const [viewport,setViewport]=useState({left:0,top:0,width:1200,height:700});
  const {cells,x,y}=useMemo(()=>layout(sheet),[sheet]);
  function measure() {
    const el=pane.current;
    if(el) setViewport({left:el.scrollLeft,top:el.scrollTop,width:el.clientWidth,height:el.clientHeight});
  }
  useLayoutEffect(()=>{
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(pane.current);
    return ()=>observer.disconnect();
  },[]);
  useLayoutEffect(()=>{if(input.current){input.current.focus();input.current.select();}},[active]);
  const rows=visible(y,Math.max(0,viewport.top-26),viewport.height+26);
  const cols=visible(x,Math.max(0,viewport.left-45),viewport.width+45);
  const tiles=new Map();
  function add(r,c,merge) {
    const address=columnName(c)+r;
    if(tiles.has(address)) return;
    const cell=cells.get(address), draft=changes[address];
    const locked=sheet.protected || cell?.locked || sheet.formulaRanges.some(f=>inside(f,r,c));
    const selected=active===address && !locked && !busy;
    const style={position:'absolute',left:x[c-1]+44,top:y[r-1]+24,width:x[merge?.end.col || c]-x[c-1],
      height:y[merge?.end.row || r]-y[r-1],border:sheet.gridLines?'1px solid #e2e8f0':undefined,
      textAlign:cell?.numeric?'right':'left',...sheet.styles[cell?.style || 0],outline:selected?'2px solid #16834c':undefined,
      outlineOffset:-2,backgroundColor:draft?'#edfaf2':sheet.styles[cell?.style || 0]?.backgroundColor};
    function move(dr,dc) {
      const nr=dr>0?(merge?.end.row || r)+1:r+dr,nc=dc>0?(merge?.end.col || c)+1:c+dc;
      if(nr<1 || nr>=y.length || nc<1 || nc>=x.length){setActive('');return;}
      const dest=sheet.merges.find(m=>inside(m,nr,nc))?.start || {row:nr,col:nc};
      setActive(columnName(dest.col)+dest.row);
      if(y[nr]>viewport.top+viewport.height-30 || y[nr-1]<viewport.top) pane.current.scrollTop=y[nr-1];
      if(x[nc]>viewport.left+viewport.width-48 || x[nc-1]<viewport.left) pane.current.scrollLeft=x[nc-1];
    }
    tiles.set(address,<div key={address} role="gridcell" aria-label={address} aria-readonly={!!locked} tabIndex={locked?-1:0}
      className="flex flex-col overflow-hidden px-0.5" style={style} onClick={()=>{if(!locked && !busy)setActive(address);}}
      onKeyDown={e=>{if(e.target===e.currentTarget && !locked && !busy && (e.key==='Enter' || e.key==='F2')){e.preventDefault();setActive(address);}}}>
      {selected ? <textarea ref={input} aria-label={'Editar '+address} spellCheck={false}
        className="absolute inset-0 h-full w-full resize-none bg-white px-0.5 outline-none ring-2 ring-inset ring-emerald-600" style={{font:'inherit',textAlign:'inherit'}}
        value={draft?.value ?? cell?.value ?? ''} onChange={e=>onChange(address,cell,e.target.value)}
        onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setActive('');} else if(e.key==='Tab' || (e.key==='Enter' && !e.altKey && !e.shiftKey)){
          e.preventDefault();move(e.key==='Enter'?1:0,e.key==='Tab'?(e.shiftKey?-1:1):0);
        }}}/> : draft?.value ?? cell?.display ?? ''}
    </div>);
  }
  const visibleMerges=sheet.merges.filter(m=>m.end.row>=rows[0] && m.start.row<=rows[rows.length-1] && m.end.col>=cols[0] && m.start.col<=cols[cols.length-1]);
  rows.forEach(r=>cols.forEach(c=>{const m=visibleMerges.find(v=>inside(v,r,c));if(m)add(m.start.row,m.start.col,m);else add(r,c);}));
  return <div ref={pane} onScroll={measure} role="grid" aria-label={sheet.name} className="relative min-h-0 flex-1 overflow-auto bg-white text-sm">
    <div className="relative" style={{width:x[x.length-1]+44,height:y[y.length-1]+24}}>
      {Array.from(tiles.values())}
      {sheet.images.map((image,i)=>{
        const point=p=>({x:x[p.col-1]+p.x,y:y[p.row-1]+p.y});
        const a=point(image.from),b=image.to && point(image.to);
        return <img alt="" draggable={false} key={i} className="pointer-events-none absolute" style={{maxWidth:'none',left:a.x+44,top:a.y+24,width:b?b.x-a.x:image.width,height:b?b.y-a.y:image.height}} src={image.src}/>;
      })}
      {cols.map(c=><div key={c} className="absolute border bg-slate-100 text-center text-xs text-slate-600" style={{top:viewport.top,left:44+x[c-1],width:x[c]-x[c-1],height:24}}>{columnName(c)}</div>)}
      {rows.map(r=><div key={r} className="absolute border bg-slate-100 text-center text-xs text-slate-600" style={{left:viewport.left,top:24+y[r-1],height:y[r]-y[r-1],width:44}}>{r}</div>)}
      <div className="absolute border bg-slate-100" style={{left:viewport.left,top:viewport.top,width:44,height:24}}/>
    </div>
  </div>;
}
