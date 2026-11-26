const {fail}=require('./request-state');

async function catalogFolder(library,source) {
  if(!['standard','temporary'].includes(source)) throw fail(400,'Catálogo inválido.');
  return library.json('/drives/'+library.drive.id+'/root?$select=id');
}
module.exports={catalogFolder};
