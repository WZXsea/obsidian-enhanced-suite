export type MobileQuickAction = 'search' | 'images' | 'outline';

/** The outline owns its entry; related entries follow currently loaded plugins. */
export function mobileQuickActions(searchLoaded:boolean,imagesLoaded:boolean):MobileQuickAction[]{
 const result:MobileQuickAction[]=[];
 if(searchLoaded)result.push('search');
 if(imagesLoaded)result.push('images');
 result.push('outline');
 return result;
}

export function runMobileQuickAction(action:MobileQuickAction,execute:(id:string)=>boolean,toggleOutline:()=>void):boolean{
 if(action==='outline'){toggleOutline();return true;}
 if(action==='images')return execute('obsidian-image-toolkit:open');
 return execute('float-search:open-mobile-search')||execute('float-search:open-cmdk-search');
}

export function mobileKeyboardVisible(layoutHeight:number,visibleHeight:number):boolean{
 return layoutHeight>0&&visibleHeight>0&&layoutHeight-visibleHeight>120;
}

export function outlineDepth(desktopDepth:number,mobileDepth:number|undefined,mobile:boolean):number{
 const value=mobile?(mobileDepth??2):desktopDepth;
 return Math.max(1,Math.min(6,Math.round(value)));
}

interface BottomBarRect {top:number;bottom:number;width:number;height:number;}
/** Keep quick actions above actual native bars, including raised or tall variants. */
export function mobileQuickBarBottom(hostBottom:number,visibleBottom:number,bars:BottomBarRect[]):number{
 let bottom=Math.max(96,hostBottom-visibleBottom+8);
 for(const rect of bars){
  if(rect.width<=0||rect.height<=0||rect.top>=visibleBottom||rect.bottom<visibleBottom-200)continue;
  bottom=Math.max(bottom,hostBottom-rect.top+8);
 }
 return Math.ceil(bottom);
}
