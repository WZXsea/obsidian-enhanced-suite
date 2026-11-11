/** A small pixel sprite drawn as SVG geometry, bundled with the plugin. */
export function appendPixelFlower(parent:HTMLElement):void {
 const ns='http://www.w3.org/2000/svg';
 const svg=parent.ownerDocument.createElementNS(ns,'svg');
 svg.setAttribute('class','nis-stage-pixel-flower');
 svg.setAttribute('viewBox','0 0 24 30');
 svg.setAttribute('width','72');svg.setAttribute('height','90');
 svg.setAttribute('shape-rendering','crispEdges');
 svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 const layers:{tone:string;pixels:number[][]}[]=[
  {tone:'stem',pixels:[[11,15,2,12],[7,19,4,2],[5,17,3,2],[15,21,4,2],[18,19,2,2]]},
  {tone:'leaf',pixels:[[4,16,3,2],[6,18,4,2],[13,22,4,2],[16,20,4,2]]},
  {tone:'petal',pixels:[[9,2,6,3],[6,4,3,4],[15,4,3,4],[4,7,4,6],[16,7,4,6],[7,13,4,3],[13,13,4,3],[10,14,4,3],[8,5,8,9]]},
  {tone:'shade',pixels:[[4,11,3,2],[6,13,3,2],[9,15,6,2],[16,11,4,2],[15,13,3,2]]},
  {tone:'light',pixels:[[10,2,3,1],[6,5,2,2],[4,8,2,2],[15,5,2,2]]},
  {tone:'gold',pixels:[[9,8,6,5],[10,7,4,1],[10,13,4,1]]},
  {tone:'gold-light',pixels:[[10,8,3,2]]},
  {tone:'gold-shade',pixels:[[13,10,2,3],[11,12,2,1]]},
  {tone:'spark',pixels:[[2,4,1,1],[21,15,1,1],[6,26,1,1]]},
 ];
 for(const {tone,pixels} of layers)for(const [x,y,width,height] of pixels){
  const rect=parent.ownerDocument.createElementNS(ns,'rect');
  rect.setAttribute('class',`nis-pixel-${tone}`);
  for(const [key,value] of Object.entries({x,y,width,height}))rect.setAttribute(key,String(value));
  svg.appendChild(rect);
 }
 parent.appendChild(svg);
}
