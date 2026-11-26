import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import ApplicantPanel, {NewRequestModal} from './ApplicantPanel';

test('muestra los datos de cada guía seleccionada y los quita al retirarla',async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const originalFetch=global.fetch;
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({guides:[
    {id:'uno',name:'Proteggo F.xlsx',product:'Proteggo',line:'Sólidos',phase:'Fabricación'},
    {id:'dos',name:'Otro E.xlsx',product:'Otro',line:'Líquidos',phase:'Envasado'}
  ]})}));
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(<ApplicantPanel view="main" requests={[]} user={{role:'Responsable',email:'usuario@biomont.com.pe'}}/>));
    await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent.includes('Nueva Solicitud')).click());
    await act(async()=>{const radio=Array.from(host.querySelectorAll('label')).find(label=>label.textContent==='Guía oficial').querySelector('input');radio.checked=true;Simulate.change(radio);});
    const search=host.querySelector('#combo-search');
    await act(async()=>{search.value='Proteggo';Simulate.change(search);});
    await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent.includes('Proteggo F.xlsx')).click());
    await act(async()=>{search.value='Otro';Simulate.change(search);});
    await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent.includes('Otro E.xlsx')).click());
    const section=host.querySelector('[aria-label="Guías seleccionadas"]');
    expect(section.textContent).toContain('Sólidos');expect(section.textContent).toContain('Fabricación');
    expect(section.textContent).toContain('Líquidos');expect(section.textContent).toContain('Envasado');
    await act(async()=>section.querySelector('[aria-label="Quitar Proteggo F.xlsx"]').click());
    expect(section.textContent).not.toContain('Fabricación');expect(section.textContent).toContain('Envasado');
  } finally {await act(async()=>root.unmount());host.remove();global.fetch=originalFetch;}
});

test('ASC puede seleccionar un emisor y asignar la guía',async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const previous=global.fetch,submit=jest.fn(async()=>{}),host=document.createElement('div');document.body.appendChild(host);
  global.fetch=jest.fn(async url=>({ok:true,json:async()=>String(url).includes('emitters=1')?[{email:'ana@biomont.com.pe',display_name:'Ana'}]:{guides:[{id:'archivo',name:'Guía.xlsx',product:'Producto',phase:'Fabricación'}]}}));
  const root=createRoot(host);
  try {
    await act(async()=>root.render(<NewRequestModal assigning onClose={()=>{}} onSubmit={submit}/>));
    const select=host.querySelector('#assigned-emitter');
    await act(async()=>{select.value='ana@biomont.com.pe';Simulate.change(select);});
    await act(async()=>{const radio=Array.from(host.querySelectorAll('label')).find(label=>label.textContent==='Guía oficial').querySelector('input');radio.checked=true;Simulate.change(radio);});
    const search=host.querySelector('#combo-search');
    await act(async()=>{search.value='Producto';Simulate.change(search);});
    await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent.includes('Guía.xlsx')).click());
    expect(Array.from(host.querySelectorAll('button')).some(button=>button.textContent==='Asignar')).toBe(true);
    await act(async()=>Simulate.submit(host.querySelector('#new-req-form')));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({emitter:'ana@biomont.com.pe',guides:[expect.objectContaining({id:'archivo'})]}));
  } finally {await act(async()=>root.unmount());host.remove();global.fetch=previous;}
});

test('la pregunta adicional aparece solo para guías temporales y cambia el catálogo',async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const previous=global.fetch,host=document.createElement('div');document.body.appendChild(host);
  global.fetch=jest.fn(async()=>({ok:true,json:async()=>({guides:[]})}));const root=createRoot(host);
  try {
    await act(async()=>root.render(<NewRequestModal onClose={()=>{}} onSubmit={()=>{}}/>));
    expect(host.textContent).not.toContain('¿Requiere modificaciones?');
    const type=Array.from(host.querySelectorAll('label')).find(label=>label.textContent==='Guía temporal').querySelector('input');
    await act(async()=>{type.checked=true;Simulate.change(type);});
    expect(host.textContent).toContain('¿Requiere modificaciones?');
    const no=Array.from(host.querySelectorAll('label')).find(label=>label.textContent==='No').querySelector('input');
    await act(async()=>{no.checked=true;Simulate.change(no);});
    expect(global.fetch.mock.calls.some(([url])=>String(url).includes('source=temporary'))).toBe(true);
    const other=Array.from(host.querySelectorAll('label')).find(label=>label.textContent==='Guía oficial').querySelector('input');
    await act(async()=>{other.checked=true;Simulate.change(other);});
    expect(host.textContent).not.toContain('¿Requiere modificaciones?');
  } finally {await act(async()=>root.unmount());host.remove();global.fetch=previous;}
});

test('una guía temporal compartida permite consulta y no muestra edición',async()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  const request={id:'REQ-1',dbId:'uno',guide:'Temporal.xlsx',stage:'TEMPORAL_COMPARTIDA',type:'Guía temporal',guides:[],history:[]};
  try {
    await act(async()=>root.render(<ApplicantPanel view="main" requests={[request]} user={{role:'Responsable',email:'usuario@biomont.com.pe'}}/>));
    expect(host.textContent).toContain('Guía temporal compartida');
    expect(host.textContent).not.toContain('Editar guía');
    await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent.trim()==='Ver').click());
    expect(host.textContent).toContain('Ver guía temporal');
    expect(host.textContent).not.toContain('Editar guía');
  } finally {await act(async()=>root.unmount());host.remove();}
});
