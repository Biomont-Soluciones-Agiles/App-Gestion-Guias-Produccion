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
    const search=host.querySelector('#combo-search');
    await act(async()=>{search.value='Producto';Simulate.change(search);});
    await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent.includes('Guía.xlsx')).click());
    expect(Array.from(host.querySelectorAll('button')).some(button=>button.textContent==='Asignar')).toBe(true);
    await act(async()=>Simulate.submit(host.querySelector('#new-req-form')));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({emitter:'ana@biomont.com.pe',guides:[expect.objectContaining({id:'archivo'})]}));
  } finally {await act(async()=>root.unmount());host.remove();global.fetch=previous;}
});
