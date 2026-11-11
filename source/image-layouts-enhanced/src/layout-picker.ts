import {App} from 'obsidian';
import {AnchoredPopover} from './popover';
import {GalleryOptions} from './types';
import {getLayoutChoices} from './layout-choices';
import {getDominantGridDefinition,GridDefinition} from './layouts';

export type LayoutPatch=Pick<GalleryOptions,'layout'>&Partial<Pick<GalleryOptions,'grid'>>;

/** Compact layout choices next to the image that opened them. */
export class LayoutPicker {
  private readonly popover:AnchoredPopover;
  constructor(_app:App,count:number,private readonly chosen:(patch:LayoutPatch)=>void,anchor?:HTMLElement,current?:Partial<GalleryOptions>){
    this.popover=new AnchoredPopover(anchor,'选择图片布局');
    this.popover.el.classList.add('ilg-layout-popover');
    const doc=this.popover.el.ownerDocument;
    const list=doc.createElement('div');list.className='ilg-picker';
    this.popover.contentEl.appendChild(list);
    const choices=getLayoutChoices(count);
    const normalizeGrid=(grid:string)=>grid.replace(/[ \t]/g,'').trim();
    let selected=choices.find(choice=>choice.layout===current?.layout&&(choice.grid===undefined||normalizeGrid(choice.grid)===normalizeGrid(current.grid??'')));
    if(!selected&&current?.layout){
      const actual=getDominantGridDefinition(current.layout,count);
      const signature=(grid:GridDefinition)=>JSON.stringify([grid.columnFractions,grid.rows,grid.areas]);
      if(actual)selected=choices.find(choice=>{const candidate=getDominantGridDefinition(choice.layout,count);return candidate&&signature(candidate)===signature(actual);});
    }
    for(const choice of choices){
      const {layout,label}=choice;
      const button=doc.createElement('button');button.type='button';button.className='ilg-picker-card';
      button.dataset.layout=layout;button.dataset.choice=choice.key;button.dataset.kind=choice.kind??'grid';button.setAttribute('aria-label',label);button.title=label;
      if(selected?.key===choice.key){button.classList.add('is-selected');button.setAttribute('aria-current','true');}
      const diagram=doc.createElement('span');diagram.className='ilg-picker-diagram';diagram.setAttribute('aria-hidden','true');
      const rows=choice.preview;
      diagram.style.gridTemplateColumns=`repeat(${rows[0].length},minmax(0,1fr))`;
      diagram.style.gridTemplateRows=`repeat(${rows.length},minmax(0,1fr))`;
      for(const letter of new Set(rows.join(''))){
        if(letter==='.'||letter===' ')continue;
        const positions=rows.flatMap((row,r)=>[...row].flatMap((value,c)=>value===letter?[[r,c]]:[]));
        const top=Math.min(...positions.map(([r])=>r)),bottom=Math.max(...positions.map(([r])=>r));
        const left=Math.min(...positions.map(([,c])=>c)),right=Math.max(...positions.map(([,c])=>c));
        const swatch=doc.createElement('span');swatch.className=`ilg-swatch ilg-swatch-${letter.charCodeAt(0)%4}`;
        swatch.style.gridArea=`${top+1}/${left+1}/${bottom+2}/${right+2}`;diagram.appendChild(swatch);
      }
      const caption=doc.createElement('span');caption.textContent=label;caption.className='ilg-picker-label';
      button.append(diagram,caption);list.appendChild(button);
      this.popover.listen(button,'click',event=>{event.stopPropagation();this.close();this.chosen({layout,...(choice.grid!==undefined?{grid:choice.grid}:{})});});
    }
  }
  open(){this.popover.open();}
  close(){this.popover.close();}
}
