const crypto=require('node:crypto');
const sharp=require('sharp');
const {unzipSync,zipSync,strFromU8,strToU8}=require('fflate');
const {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const path=require('node:path').posix;
const {openWorkbook}=require('./workbook');
const {fail}=require('./request-state');

const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG='http://schemas.openxmlformats.org/package/2006/relationships';
const XDR='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const ALL=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const marker={Elaborador:{name:'B7',from:0,to:4,label:'Elaborado'},Revision:{name:'F7',from:4,to:7,label:'Revisado'},Aprobacion:{name:'H7',from:7,to:11,label:'Aprobado'}};

async function stampSignature(buffer,step,signers) {
  const slot=marker[step];
  if(!slot || !Array.isArray(signers) || !signers.length || signers.length>20) throw fail(400,'Datos de firma inválidos.');
  const book=openWorkbook(buffer),sheetName=book.sheets[0],sheet=book.inspect(sheetName);
  const find=address=>sheet.cells.find(c=>c.address===address)?.value || '';
  const label=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!label(find('B6')).includes('elaborado') || !label(find('F6')).includes('revisado') || !label(find('H6')).includes('aprobado'))
    throw fail(422,'La guía no tiene las áreas de firma esperadas en la primera hoja.');
  const rows=signers.map(person=>{
    const date=new Date(person.signed_at);
    if(!person.display_name || !Number.isFinite(date.getTime())) throw fail(400,'La información de firma es inválida.');
    return {name:String(person.display_name).slice(0,120),date:new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',dateStyle:'short',timeStyle:'short'}).format(date)};
  });
  const columns=rows.length>6?2:1,perColumn=Math.ceil(rows.length/columns);
  const lineHeight=290/perColumn,fontSize=Math.min(42,Math.max(8,Math.floor(lineHeight*.55))),dateSize=Math.min(13,Math.max(6,Math.floor(lineHeight*.25)));
  const content=rows.map((r,i)=>{const x=16+Math.floor(i/perColumn)*(1000/columns),y=5+(i%perColumn)*lineHeight+fontSize;return '<text x="'+x+'" y="'+y+'" font-size="'+fontSize+'" textLength="'+(1000/columns-32)+'" lengthAdjust="spacingAndGlyphs" font-family="serif" font-style="italic" fill="#162735">'+escape(r.name)+'</text><text x="'+x+'" y="'+(y+dateSize+2)+'" font-size="'+dateSize+'" font-family="sans-serif" fill="#175bb5">'+escape(r.date)+'</text>';}).join('');
  const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300">'+content+'</svg>')).png().toBuffer();

  const updated=book.apply([{sheet:sheetName,address:slot.name,value:rows.map(r=>r.name).join(' / '),type:'text'}]);
  const files=unzipSync(updated),parse=name=>new DOMParser().parseFromString(strFromU8(files[name]),'application/xml');
  const workbook=parse('xl/workbook.xml'),rels=parse('xl/_rels/workbook.xml.rels');
  const sheetNode=ALL(workbook,'sheet').find(n=>n.getAttribute('name')===sheetName);
  const sheetRel=ALL(rels,'Relationship').find(n=>n.getAttribute('Id')===sheetNode.getAttribute('r:id'));
  const target=sheetRel.getAttribute('Target'),sheetPath=target.startsWith('/')?target.slice(1):path.normalize(path.join('xl',target));
  const doc=parse(sheetPath),sheetRelsPath=path.join(path.dirname(sheetPath),'_rels',path.basename(sheetPath)+'.rels');
  const sheetRels=files[sheetRelsPath]?parse(sheetRelsPath):new DOMParser().parseFromString('<Relationships xmlns="'+PKG+'"/>','application/xml');
  let drawing=ALL(doc,'drawing')[0], drawingPath;
  if(drawing) {
    const rel=ALL(sheetRels,'Relationship').find(n=>n.getAttribute('Id')===drawing.getAttribute('r:id'));
    if(!rel) throw fail(422,'No se encontró el área de imágenes de la guía.');
    const t=rel.getAttribute('Target');drawingPath=t.startsWith('/')?t.slice(1):path.normalize(path.join(path.dirname(sheetPath),t));
  } else {
    const rid='rIdFirma'+crypto.randomBytes(8).toString('hex');
    const name='drawingFirma'+crypto.randomBytes(8).toString('hex')+'.xml';
    drawingPath='xl/drawings/'+name;
    const rel=sheetRels.createElementNS(PKG,'Relationship');
    rel.setAttribute('Id',rid);rel.setAttribute('Type',REL+'/drawing');rel.setAttribute('Target','../drawings/'+name);
    sheetRels.documentElement.appendChild(rel);
    drawing=doc.createElementNS(MAIN,'drawing');drawing.setAttributeNS(REL,'r:id',rid);
    const following=Array.from(doc.documentElement.childNodes).find(n=>['legacyDrawing','legacyDrawingHF','picture','oleObjects','controls','webPublishItems','tableParts','extLst'].includes(n.localName));
    doc.documentElement.insertBefore(drawing,following || null);
    files[sheetPath]=strToU8(new XMLSerializer().serializeToString(doc));
    files[sheetRelsPath]=strToU8(new XMLSerializer().serializeToString(sheetRels));
    files[drawingPath]=strToU8('<xdr:wsDr xmlns:xdr="'+XDR+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="'+REL+'"/>');
    const types=parse('[Content_Types].xml'),override=types.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types','Override');
    override.setAttribute('PartName','/'+drawingPath);override.setAttribute('ContentType','application/vnd.openxmlformats-officedocument.drawing+xml');
    types.documentElement.appendChild(override);files['[Content_Types].xml']=strToU8(new XMLSerializer().serializeToString(types));
  }
  if(!files[drawingPath]) throw fail(422,'No se encontró el área de imágenes de la guía.');
  const draw=parse(drawingPath),drawingRelsPath=path.join(path.dirname(drawingPath),'_rels',path.basename(drawingPath)+'.rels');
  const drawingRels=files[drawingRelsPath]?parse(drawingRelsPath):new DOMParser().parseFromString('<Relationships xmlns="'+PKG+'"/>','application/xml');
  for(const item of ALL(draw,'cNvPr')) if(item.getAttribute('name')==='BiomontFirma_'+step) {
    let anchor=item;
    while(anchor.parentNode && !['twoCellAnchor','oneCellAnchor'].includes(anchor.localName)) anchor=anchor.parentNode;
    if(anchor.parentNode) anchor.parentNode.removeChild(anchor);
  }
  const id=crypto.randomBytes(10).toString('hex'),rid='rIdFirma'+id,media='firma_'+id+'.png';
  const relationship=drawingRels.createElementNS(PKG,'Relationship');
  relationship.setAttribute('Id',rid);relationship.setAttribute('Type',REL+'/image');relationship.setAttribute('Target','../media/'+media);
  drawingRels.documentElement.appendChild(relationship);
  const nextId=Math.max(0,...ALL(draw,'cNvPr').map(n=>Number(n.getAttribute('id')) || 0))+1;
  const xml='<xdr:twoCellAnchor xmlns:xdr="'+XDR+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="'+REL+'"><xdr:from><xdr:col>'+slot.from+'</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>7</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>'+slot.to+'</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>8</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="'+nextId+'" name="BiomontFirma_'+step+'"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="'+rid+'"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>';
  draw.documentElement.appendChild(draw.importNode(new DOMParser().parseFromString(xml,'application/xml').documentElement,true));
  files[drawingPath]=strToU8(new XMLSerializer().serializeToString(draw));
  files[drawingRelsPath]=strToU8(new XMLSerializer().serializeToString(drawingRels));
  files['xl/media/'+media]=png;
  const types=parse('[Content_Types].xml');
  if(!ALL(types,'Default').some(n=>n.getAttribute('Extension').toLowerCase()==='png')) {
    const node=types.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types','Default');
    node.setAttribute('Extension','png');node.setAttribute('ContentType','image/png');
    types.documentElement.appendChild(node);files['[Content_Types].xml']=strToU8(new XMLSerializer().serializeToString(types));
  }
  return Buffer.from(zipSync(files));
}
module.exports={stampSignature};
