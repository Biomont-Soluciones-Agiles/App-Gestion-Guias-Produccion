import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import GuideViewer from './GuideViewer';

test('escribe directamente en una celda y envía a revisión el archivo guardado',async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  global.ResizeObserver=class {observe(){} disconnect(){}};
  const host=document.createElement('div');
  document.body.appendChild(host);
  Object.defineProperty(HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>800});
  Object.defineProperty(HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>500});
  const root=createRoot(host);
  const sheet={name:'Envasado',styles:[],defaultWidth:70,defaultHeight:20,rows:[],columns:[],images:[],merges:[],formulaRanges:[],
    cells:[{address:'B2',row:2,col:2,value:'Inicial',display:'Inicial',textual:true}]};
  const onSubmit=jest.fn(),onSaved=jest.fn();
  const previousFetch=global.fetch;
  global.fetch=jest.fn(async(url,opts)=>({ok:true,json:async()=>opts.method==='POST'?{itemId:'nueva'}:{revision:'r1',itemId:'original',sheet,sheets:[sheet.name]}}));
  try {
    await act(async()=>root.render(<GuideViewer data={{dbId:'123',guide:'Guía.xlsx'}} editable onSaved={onSaved} onSubmit={onSubmit}/>));
    await act(async()=>host.querySelector('[aria-label="B2"]').click());
    const input=host.querySelector('textarea');
    expect(input.value).toBe('Inicial');
    await act(async()=>{input.value='Modificada';Simulate.change(input);});
    await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Enviar a Jefatura').click());
    const post=global.fetch.mock.calls.find(([,opts])=>opts.method==='POST');
    expect(JSON.parse(post[1].body).changes).toEqual([{address:'B2',sheet:'Envasado',value:'Modificada',type:'text'}]);
    expect(onSubmit).toHaveBeenCalledWith('nueva');
    expect(onSaved).toHaveBeenCalledWith('nueva');
  } finally {
    await act(async()=>root.unmount());
    host.remove();
    global.fetch=previousFetch;
  }
});
