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

export default function WorksheetGrid({sheet,changes,onChange,onImageChange,busy,readOnly=false,marks={}}) {
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
    const locked=readOnly || sheet.protected || cell?.locked || sheet.formulaRanges.some(f=>inside(f,r,c));
    const selected=active===address && !locked && !busy;
    const style={position:'absolute',left:x[c-1]+44,top:y[r-1]+24,width:x[merge?.end.col || c]-x[c-1],
      height:y[merge?.end.row || r]-y[r-1],border:sheet.gridLines?'1px solid #e2e8f0':undefined,
      textAlign:cell?.numeric?'right':'left',...sheet.styles[cell?.style || 0],outline:selected?'2px solid #16834c':undefined,
      outlineOffset:-2,backgroundColor:marks[address]==='removed'?'#fee2e2':marks[address]==='changed'?'#fef08a':draft?'#edfaf2':sheet.styles[cell?.style || 0]?.backgroundColor};
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
    {marks[address]==='removed' && <span className="absolute right-1 top-0 font-bold text-red-700">×</span>}
    {marks[address]==='removed' && <span className="absolute right-1 top-0 font-bold text-red-700">×</span>}
    </div>);
  }
  const visibleMerges=sheet.merges.filter(m=>m.end.row>=rows[0] && m.start.row<=rows[rows.length-1] && m.end.col>=cols[0] && m.start.col<=cols[cols.length-1]);
  rows.forEach(r=>cols.forEach(c=>{const m=visibleMerges.find(v=>inside(v,r,c));if(m)add(m.start.row,m.start.col,m);else add(r,c);}));
  return <div ref={pane} onScroll={measure} role="grid" aria-label={sheet.name} className="relative min-h-0 flex-1 overflow-auto bg-white text-sm">
    <div className="relative" style={{width:x[x.length-1]+44,height:y[y.length-1]+24}}>
      {Array.from(tiles.values())}
      {sheet.images.map(image=>{
        const edit=changes['image:'+image.id];
        if(edit?.action==='delete') return null;
        const selected=active==='image:'+image.id;
        return <SheetPicture key={image.id} image={image} edit={edit} x={x} y={y}
          disabled={busy || readOnly || sheet.protected} selected={selected} onSelect={()=>setActive('image:'+image.id)}
          onChange={patch=>onImageChange(image.id,patch)} onDeselect={()=>setActive('')}/>;
      })}
      {cols.map(c=><div key={c} className="absolute border bg-slate-100 text-center text-xs text-slate-600" style={{top:viewport.top,left:44+x[c-1],width:x[c]-x[c-1],height:24}}>{columnName(c)}</div>)}
      {rows.map(r=><div key={r} className="absolute border bg-slate-100 text-center text-xs text-slate-600" style={{left:viewport.left,top:24+y[r-1],height:y[r]-y[r-1],width:44}}>{r}</div>)}
      <div className="absolute border bg-slate-100" style={{left:viewport.left,top:viewport.top,width:44,height:24}}/>
    </div>
  </div>;
}

function markerAt(axis,pixel) {
  let low=1, high=axis.length-1;
  while(low<high) {
    const mid=Math.floor((low+high)/2);
    if(axis[mid]<=pixel) low=mid+1;
    else high=mid;
  }
  return {index:low,offset:pixel-axis[low-1]};
}
function SheetPicture({image,edit,x,y,disabled,selected,onSelect,onChange,onDeselect}) {
  const drag=useRef(null);
  const [delta,setDelta]=useState(null);
  const pixels=p=>({x:x[p.col-1]+p.x,y:y[p.row-1]+p.y});
  const a=pixels(edit?.from || image.from);
  const b=image.to ? pixels(edit?.to || image.to) : {x:a.x+image.width,y:a.y+image.height};
  const width=b.x-a.x,height=b.y-a.y;
  function displacement(e) {
    return {x:Math.max(-a.x,Math.min(x[x.length-1]-b.x,e.clientX-drag.current.x)),
      y:Math.max(-a.y,Math.min(y[y.length-1]-b.y,e.clientY-drag.current.y))};
  }
  function move(dx,dy) {
    if(disabled || (!dx && !dy)) return;
    const marker=p=>{
      const col=markerAt(x,p.x+dx),row=markerAt(y,p.y+dy);
      return {col:col.index,row:row.index,x:col.offset,y:row.offset};
    };
    onChange({action:'move',from:marker(a),to:image.to?marker(b):null});
  }
  function remove() {
    if(disabled) return;
    if(window.confirm('Â¿Eliminar esta imagen de la versiÃ³n en ediciÃ³n?')) {
      onChange({action:'delete'});onDeselect();
    }
  }
  return <div className="absolute" style={{left:44+a.x+(delta?.x || 0),top:24+a.y+(delta?.y || 0),width,height,zIndex:selected?2:undefined}}>
    <button type="button" aria-label={'Seleccionar '+image.name} aria-pressed={selected} disabled={disabled}
      className="block h-full w-full select-none" style={{touchAction:'none',cursor:disabled?'default':'move',outline:selected?'2px solid #16834c':undefined}}
      onClick={onSelect} onPointerDown={e=>{
        if(disabled || e.button!==0) return;
        onSelect();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e=>{if(drag.current?.id===e.pointerId)setDelta(displacement(e));}}
      onLostPointerCapture={()=>{drag.current=null;setDelta(null);}}
      onPointerUp={e=>{
        if(drag.current?.id!==e.pointerId) return;
        if(e.clientX!==drag.current.x || e.clientY!==drag.current.y) {
          const d=displacement(e);move(d.x,d.y);
        }
        drag.current=null;setDelta(null);
      }} onKeyDown={e=>{
        if(e.key==='Delete'){e.preventDefault();remove();}
        if(e.key==='Escape')onDeselect();
      }}>
      <img alt="" draggable={false} src={image.src} className="pointer-events-none h-full w-full"/>
    </button>
    {selected && !disabled && <button type="button" onClick={remove} className="absolute right-0 top-0 rounded bg-white px-2 py-1 text-xs font-semibold text-red-700 shadow">Eliminar imagen</button>}
  </div>;
}
