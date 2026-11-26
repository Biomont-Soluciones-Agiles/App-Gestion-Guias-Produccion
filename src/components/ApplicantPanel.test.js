import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import ApplicantPanel from './ApplicantPanel';

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
