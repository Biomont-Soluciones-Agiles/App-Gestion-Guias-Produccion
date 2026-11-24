const path = require('node:path').posix;
const SSF = require('ssf');
const all = (n, tag) => n ? Array.from(n.getElementsByTagNameNS('*',tag)) : [];
const first = (n,tag) => all(n,tag)[0];
const attr = (n,k,fallback) => n?.hasAttribute(k) ? n.getAttribute(k) : fallback;
const indexed=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF'];
function color(node) {
  const i=Number(attr(node,'indexed',-1));
  const rgb=attr(node,'rgb','').slice(-6) || (i>=0 && i<16 ? indexed[i%8] : undefined);
  return /^[a-f0-9]{6}$/i.test(rgb || '') ? '#'+rgb : undefined;
}
function styles(doc) {
  const fonts=all(first(doc,'fonts'),'font'), fills=all(first(doc,'fills'),'fill'), borders=all(first(doc,'borders'),'border');
  const formats=Object.fromEntries(all(doc,'numFmt').map(n=>[attr(n,'numFmtId'),attr(n,'formatCode')]));
  return all(first(doc,'cellXfs'),'xf').map(xf=>{
    const font=fonts[attr(xf,'fontId',0)], fill=fills[attr(xf,'fillId',0)], border=borders[attr(xf,'borderId',0)];
    const align=first(xf,'alignment'), horizontal=attr(align,'horizontal'), vertical=attr(align,'vertical','bottom');
    const css={fontFamily:attr(first(font,'name'),'val','Calibri')+', Arial, sans-serif',
      fontSize:Number(attr(first(font,'sz'),'val',11))*4/3, fontWeight:first(font,'b')?'bold':undefined,
      fontStyle:first(font,'i')?'italic':undefined,textDecoration:first(font,'u')?'underline':undefined,
      color:color(first(font,'color')),backgroundColor:attr(first(fill,'patternFill'),'patternType')==='solid'?color(first(fill,'fgColor')):undefined,
      textAlign:['left','center','right','justify'].includes(horizontal)?horizontal:undefined,
      justifyContent:vertical==='center'?'center':vertical==='top'?'flex-start':'flex-end',whiteSpace:attr(align,'wrapText')==='1'?'pre-wrap':'pre'};
    for(const side of ['Left','Right','Top','Bottom']){
      const line=first(border,side.toLowerCase()),kind=attr(line,'style');
      if(kind && kind!=='none') css['border'+side]=(kind==='thick'?3:kind==='medium'?2:1)+'px '+(kind==='dotted'?'dotted':kind==='dashed'?'dashed':'solid')+' '+(color(first(line,'color')) || '#222');
    }
    const id=Number(attr(xf,'numFmtId',0));
    return {css,format:formats[id] || SSF.get_table()[id] || 'General'};
  });
}
function pictureObjects(sheetPath,doc,files,read) {
  function target(source,id) {
    const rp=path.join(path.dirname(source),'_rels',path.basename(source)+'.rels');
    if(!id || !files[rp]) return;
    const rel=all(read(rp),'Relationship').find(n=>attr(n,'Id')===id && attr(n,'TargetMode')!=='External');
    if(!rel) return;
    const t=attr(rel,'Target');
    return t.startsWith('/')?t.slice(1):path.join(path.dirname(source),t);
  }
  const drawing=target(sheetPath,attr(first(doc,'drawing'),'r:id'));
  if(!drawing || !files[drawing]) return {objects:[]};
  const xml=read(drawing);
  const point=n=>({col:1+Number(first(n,'col').textContent),row:1+Number(first(n,'row').textContent),
    x:Number(first(n,'colOff')?.textContent || 0)/9525,y:Number(first(n,'rowOff')?.textContent || 0)/9525});
  const objects=[...all(xml,'twoCellAnchor'),...all(xml,'oneCellAnchor')].flatMap((anchor,index)=>{
    const pic=Array.from(anchor.childNodes).find(n=>n.localName==='pic');
    const media=target(drawing,attr(first(pic,'blip'),'r:embed'));
    if(!media || !files[media] || !/\.(png|jpe?g|gif)$/i.test(media)) return [];
    const to=first(anchor,'to'),ext=Array.from(anchor.childNodes).find(n=>n.localName==='ext');
    const mime=/png$/i.test(media)?'png':/gif$/i.test(media)?'gif':'jpeg';
    return [{anchor, media, id:String(index), name:attr(first(pic,'cNvPr'),'name','Imagen'), from:point(first(anchor,'from')),to:to?point(to):null,width:Number(attr(ext,'cx',0))/9525,height:Number(attr(ext,'cy',0))/9525,
      mime}];
  });
  return {xml,drawing,objects};
}
function inspectSheet({name,doc,cells,value,sheetPath,files,read,formats,date1904,cellPosition}) {
  const defaults=first(doc,'sheetFormatPr');
  const range=n=>{
    const [start,end]=n.getAttribute('ref').split(':');
    return {start:cellPosition(start),end:cellPosition(end || start)};
  };
  return {name,protected:!!first(doc,'sheetProtection'),styles:formats.map(f=>f.css),
    gridLines:attr(first(doc,'sheetView'),'showGridLines')!=='0',
    defaultWidth:Number(attr(defaults,'defaultColWidth',9))*7, defaultHeight:Number(attr(defaults,'defaultRowHeight',15))*4/3,
    columns:all(doc,'col').map(c=>({min:Number(attr(c,'min')),max:Number(attr(c,'max')),width:attr(c,'hidden')==='1'?0:Number(attr(c,'width',9))*7})),
    rows:all(doc,'row').map(r=>({row:Number(attr(r,'r')),height:attr(r,'hidden')==='1'?0:Number(attr(r,'ht',attr(defaults,'defaultRowHeight',15)))*4/3})),
    merges:all(doc,'mergeCell').map(range),formulaRanges:all(doc,'f').filter(f=>f.hasAttribute('ref')).map(range),
    images:pictureObjects(sheetPath,doc,files,read).objects.map(({anchor,media,mime,...image})=>({...image,src:'data:image/'+mime+';base64,'+Buffer.from(files[media]).toString('base64')})),
    cells:Array.from(cells,([address,c])=>{
      const type=attr(c,'t','n'),raw=value(c),style=Number(attr(c,'s',0)),numeric=type==='n' && raw!=='';
      let display=raw;
      if(numeric) { try {display=SSF.format(formats[style]?.format || 'General',Number(raw),{date1904});} catch {display=raw;} }
      return {address,...cellPosition(address),style,value:raw,display,numeric,textual:['s','inlineStr','str'].includes(type),
        locked:!!first(c,'f') || ['b','e','d'].includes(type)};
    })};
}
module.exports={styles,inspectSheet,pictureObjects};
