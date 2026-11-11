export type Layout = 'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'|'i'|'single'|'masonry-2'|'masonry-3'|'masonry-4'|'masonry-5'|'masonry-6'|'stage-left'|'stage-right'|'carousel'|'filmstrip'|'focus'|'custom';
export type Fit = 'contain'|'cover'|'natural';
export interface GalleryOptions {
  id: string; layout: Layout; fit: Fit; height: number; gap: number; radius: number;
  caption: string; grid: string; thumbnails: boolean; overlay: 'never'|'hover'|'always';
  align: 'left'|'center'|'right'|'full'; width: string; descriptions: string[];
  fromFolder: string; sortBy: 'name'|'mtime'; reverse: boolean; limit: number;
}
export interface GalleryGroup {
  from: number; to: number; bodyFrom: number; bodyTo: number; startLine: number; endLine: number;
  body: string; raw: string; options: GalleryOptions; kind: 'comment'|'fence';
}
export interface GalleryImage {
  src: string; alt: string; target: string; line: number; sourceOffset: number; missing?: boolean;
}
export interface GalleryCallbacks {
  open: (index: number, origin?: HTMLImageElement) => void;
  change: (patch: Partial<GalleryOptions>) => void;
  edit: (anchor?: HTMLElement) => void;
  configure?: (anchor?: HTMLElement) => void;
  pickLayout?: (anchor: HTMLElement) => void;
  initialIndex?: number;
  select?: (index: number) => void;
  unwrap: () => void;
}
export const DEFAULT_OPTIONS: GalleryOptions = {
  id: '', layout: 'g', fit: 'contain', height: 320, gap: 8, radius: 8, caption: '',
  grid: 'A A B\nA A C', thumbnails: true, overlay: 'never', align: 'full', width: '100%',
  descriptions: [], fromFolder: '', sortBy: 'name', reverse: false, limit: 0,
};
export const LAYOUT_LABELS: Record<Layout,string> = {
  a:'双图等宽',b:'左大右小',c:'左小右大',d:'左主图＋两图',e:'右主图＋两图',
  f:'左主图＋三图',g:'右主图＋三图',h:'三图等宽',i:'四图等宽',single:'单图',
  'masonry-2':'瀑布流 · 两列','masonry-3':'瀑布流 · 三列','masonry-4':'瀑布流 · 四列',
  'masonry-5':'瀑布流 · 五列','masonry-6':'瀑布流 · 六列',carousel:'主图＋底部缩略图',
  'stage-left':'左主图＋全部图片','stage-right':'右主图＋全部图片',
  filmstrip:'横向图片带',focus:'主图＋侧边方格',custom:'自定义网格',
};
