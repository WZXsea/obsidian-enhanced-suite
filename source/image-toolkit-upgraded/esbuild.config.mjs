import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
const bundle=await build({entryPoints:['src/main.ts'],bundle:true,external:['obsidian'],format:'cjs',target:'es2022',write:false});
let original=readFileSync('upstream/main.js','utf8').replace(/^\/\/# sourceMappingURL=.*$/gm,'');
const previewOpenAnchor='            this.openOitContainerView(matchedImg);';
const previewReadyAnchor="                        imgCto.imgViewEl.style.setProperty('mix-blend-mode', imgCto.defaultImgStyle.mixBlendMode);";
const previewClearAnchor="            imgViewEl.hidden = !src && !alt;";
for(const anchor of [previewOpenAnchor,previewReadyAnchor,previewClearAnchor])if(!original.includes(anchor))throw new Error('Upstream preview enhancement anchor changed');
original=original.replace(previewOpenAnchor,previewOpenAnchor+'\n            this.plugin.noteImageStage?.prepareDesktopPreview(this,targetEl);');
original=original.replace(previewReadyAnchor,previewReadyAnchor+'\n                        this.plugin.noteImageStage?.revealDesktopPreview(this,imgCto.imgViewEl);');
original=original.replace(previewClearAnchor,previewClearAnchor+'\n            if(!src)this.plugin.noteImageStage?.clearDesktopPreview(this);');
// Upstream uses Node crypto only for popout IDs; Web Crypto is also available in Android WebView.
const cryptoAnchor="var crypto = require('crypto');";
if(!original.includes(cryptoAnchor))throw new Error('Upstream crypto anchor changed');
original=original.replace(cryptoAnchor,`var crypto = {randomUUID: () => globalThis.crypto?.randomUUID?.() ?? ('oit-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2))};`);
const mobileClickAnchor='        this.clickImage = (event) => {';
if(!original.includes(mobileClickAnchor))throw new Error('Upstream image click anchor changed');
original=original.replace(mobileClickAnchor,mobileClickAnchor+`\n            if(obsidian.Platform.isMobile && this.noteImageStage?.openMobileImage(event))return;`);
const activeViewAnchor='            const activeView = this.plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);';
if(!original.includes(activeViewAnchor)) throw new Error('Upstream gallery source-view anchor changed');
original=original.replace(activeViewAnchor,`            const galleryOrigin=this.mainContainerView.getLastClickedImgEl();
            const galleryBridge=this.plugin.noteImageStage?.galleryContext;
            const bridgeView=galleryBridge?.origin===galleryOrigin ? this.plugin.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find(view=>view instanceof obsidian.MarkdownView && view.file?.path===galleryBridge.sourcePath && view.containerEl.contains(galleryOrigin)) : null;
            const activeView = bridgeView ?? this.plugin.app.workspace.getActiveViewOfType(obsidian.MarkdownView);`);
// Reload keeps popout body attributes while the previous factory is cleared.
const popoutAnchor='                            if (!bodyEl.hasAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT)) {';
if(!original.includes(popoutAnchor)) throw new Error('Upstream popout recovery anchor changed');
original=original.replace(popoutAnchor,'                            if (!bodyEl.hasAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT) || !this.containerFactory.getPopoutContainer(bodyEl.getAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT))) {');
const eventIdAnchor='                                const eventId = crypto.randomUUID();';
if(!original.includes(eventIdAnchor)) throw new Error('Upstream popout event-id anchor changed');
original=original.replace(eventIdAnchor,'                                const eventId = bodyEl.getAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT) || crypto.randomUUID();');
const windowEventAnchor="            this.app.workspace.on('layout-change', () => {";
const windowEventClose='            });\n        });\n    }\n    onunload() {';
if(!original.includes(windowEventAnchor)||!original.includes(windowEventClose)) throw new Error('Upstream popout lifecycle anchor changed');
original=original.replace(windowEventAnchor,"            this.registerEvent(this.app.workspace.on('layout-change', () => {");
original=original.replace(windowEventClose,'            }));\n        });\n    }\n    onunload() {');
const windowTriggerAnchor='                                this.refreshViewTrigger(bodyEl.ownerDocument);';
if(!original.includes(windowTriggerAnchor)) throw new Error('Upstream popout document anchor changed');
original=original.replace(windowTriggerAnchor,'                                this.imageLayoutDocuments?.add(bodyEl.ownerDocument);\n'+windowTriggerAnchor);
const galleryAnchor='            const imgList = galleryImg.galleryImgList;';
if(!original.includes(galleryAnchor)) throw new Error('Upstream gallery list anchor changed');
original=original.replace(galleryAnchor,`            const stageImage=this.mainContainerView.getLastClickedImgEl();
            const bridgeContext=this.plugin.noteImageStage?.galleryContext;
            const layoutContext=bridgeContext?.origin===stageImage && bridgeContext.sourcePath===activeFile.path ? bridgeContext : null;
            const stageImages=stageImage?.hasAttribute('data-nis-index') ? this.plugin.noteImageStage?.galleryImages : null;
            const bridgeImages=layoutContext?.images ?? stageImages;
            const imgList = bridgeImages ? bridgeImages.map(img => ({...img,hash:md5Img(img.alt,img.src)})) : galleryImg.galleryImgList;`);
const hashAnchor='        this.getTargetImgContextHash = (targetImgEl, containerEl, imageSelector) => {';
if(!original.includes(hashAnchor)) throw new Error('Upstream gallery context anchor changed');
original=original.replace(hashAnchor,hashAnchor+`
            const layoutContext=this.plugin.noteImageStage?.galleryContext;
            if(layoutContext?.origin===targetImgEl) {
                const hash=img=>img ? md5Img(img.alt,img.src) : null;
                return [hash(layoutContext.images[layoutContext.index-1]),hash(layoutContext.images[layoutContext.index]),hash(layoutContext.images[layoutContext.index+1])];
            }
            const stageImages=this.plugin.noteImageStage?.galleryImages;
            const stageIndex=Number(targetImgEl?.getAttribute('data-nis-index'));
            if(targetImgEl?.hasAttribute('data-nis-index') && stageImages?.[stageIndex]) {
                const hash=img=>img ? md5Img(img.alt,img.src) : null;
                return [hash(stageImages[stageIndex-1]),hash(stageImages[stageIndex]),hash(stageImages[stageIndex+1])];
            }`);
const selectedAnchor='                if (imgContextHash[1] == img.hash) {';
if(!original.includes(selectedAnchor)) throw new Error('Upstream gallery selection anchor changed');
original=original.replace(selectedAnchor,'                if (layoutContext ? i === layoutContext.index : imgContextHash[1] == img.hash) {');
const removeAnchor='        this.removeOitContainerView = () => {';
if(!original.includes(removeAnchor)) throw new Error('Upstream gallery remove anchor changed');
const releaseContext='            if(this.plugin.noteImageStage?.galleryContext && this.plugin.noteImageStage.galleryContext.origin===this.lastClickedImgEl) this.plugin.noteImageStage.galleryContext=null;';
original=original.replace(removeAnchor,removeAnchor+'\n'+releaseContext+`
            this.plugin.noteImageStage?.clearDesktopPreview(this,true);
            this.imgGlobalStatus.popup=false;
            this.doc?.removeEventListener('keydown',this.triggerKeydown);
            this.doc?.removeEventListener('keyup',this.triggerKeyup);
            for(const img of this.imgInfo.imgList) {
                if(this.doc && this.imgInfo.oitContainerEl && img.imgViewEl) this.addOrRemoveEvents(img,false);
                if(img.refreshImgInterval){clearInterval(img.refreshImgInterval);img.refreshImgInterval=null;}
            }
            if(this.imgGlobalStatus.clickTimer){clearTimeout(this.imgGlobalStatus.clickTimer);this.imgGlobalStatus.clickTimer=null;}
            this.imgGlobalStatus.clickCount=0;
            if(this.imgInfo.imgTipTimeout){clearTimeout(this.imgInfo.imgTipTimeout);this.imgInfo.imgTipTimeout=null;}`);
// Clear only after the close handler has accepted its event and active image.
const closeAnchor='            if (!activeImg && !(activeImg = this.imgGlobalStatus.activeImg))\n                return;\n            if (this.imgInfo.oitContainerEl) {';
if(!original.includes(closeAnchor)) throw new Error('Upstream gallery close anchor changed');
original=original.replace(closeAnchor,'            if (!activeImg && !(activeImg = this.imgGlobalStatus.activeImg))\n                return;\n'+releaseContext+'\n            if (this.imgInfo.oitContainerEl) {');
// Pin can hold several images: closing another pin preserves the current gallery session.
const pinCloseAnchor="            // console.log('closeContainerView', event, activeImg)\n            this.renderImgView(activeImg.imgViewEl, '', '');";
if(!original.includes(pinCloseAnchor)) throw new Error('Upstream pin gallery close anchor changed');
original=original.replace(pinCloseAnchor,"            // console.log('closeContainerView', event, activeImg)\n            const bridgeContext=this.plugin.noteImageStage?.galleryContext;\n            if(bridgeContext && bridgeContext.origin===activeImg.targetOriginalImgEl) this.plugin.noteImageStage.galleryContext=null;\n            this.renderImgView(activeImg.imgViewEl, '', '');");
const clickedAnchor='            // \'data-oit-target\' is set for locating current image';
if(!original.includes(clickedAnchor)) throw new Error('Upstream gallery clicked-image anchor changed');
original=original.replace(clickedAnchor,`            if(this.plugin.noteImageStage?.galleryContext && this.plugin.noteImageStage.galleryContext.origin!==targetEl) this.plugin.noteImageStage.galleryContext=null;\n`+clickedAnchor);
const contextAnchor=`            if (0 > targetIdx)
                targetImgHash = md5Img(targetImgEl.alt, targetImgEl.src);`;
if(!original.includes(contextAnchor)) throw new Error('Upstream gallery anchor changed');
original=original.replace(contextAnchor,`            if (0 > targetIdx) {
                targetImgHash = md5Img(targetImgEl.alt, targetImgEl.src);
                return [null, targetImgHash, null];
            }`);
const marker='        //region >>> HOTKEYS_SETTINGS';
if(!original.includes(marker)) throw new Error('Upstream settings anchor changed');
original=original.replace(marker,`        new obsidian.Setting(containerEl)
            .setName('台前调度式图片导航')
            .setDesc('文章左侧的悬浮缩略图带，支持上下滚动；点击放大，右键跳转正文。')
            .addDropdown(dropdown => dropdown
                .addOption('always', '始终显示')
                .addOption('hover', '悬停显示')
                .addOption('off', '关闭')
                .setValue(this.plugin.settings.noteImageStageMode ?? 'always')
                .onChange(value => this.plugin.noteImageStage.setMode(value)))
            .addButton(button => button.setButtonText('显示导航').onClick(() => {
                this.app.setting.close();
                void this.plugin.noteImageStage.open();
            }));
        new obsidian.Setting(containerEl)
            .setName('图片导航大小')
            .setDesc('缩略图显示宽度；也可拖动图片导航右缘调节。')
            .addSlider(slider => slider.setLimits(120,320,10)
                .setValue(this.plugin.noteImageStage.getWidth())
                .setDynamicTooltip()
                .onChange(value => this.plugin.noteImageStage.setWidth(value)));
${marker}`);
const addon=bundle.outputFiles[0].text;
writeFileSync('main.js',original+`\n// Local floating image navigation upgrade; upstream viewer preserved.\n(()=>{\nconst OriginalToolkit=module.exports;\nconst addonModule={exports:{}};\n((module,exports)=>{\n${addon}\n})(addonModule,addonModule.exports);\nmodule.exports=class ImageToolkitWithStage extends OriginalToolkit {\nimageLayoutDocuments=new Set();
ensureImageContainer(origin){
const existing=this.containerFactory.getContainer(origin);if(existing)return existing;
const body=origin?.ownerDocument?.body;if(!body?.classList.contains('is-popout-window'))return null;
const mode=this.getViewMode();
const container=mode===ViewMode.Normal ? new NormalContainerView(this) : mode===ViewMode.Pin ? new PinContainerView(this) : null;
if(!container)return null;
const eventId=body.getAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT)||crypto.randomUUID();
this.containerFactory.setPopoutContainer(eventId,container);body.setAttribute(ImageToolkitPlugin.POPOUT_WINDOW_EVENT,eventId);
this.imageLayoutDocuments.add(body.ownerDocument);this.refreshViewTrigger(body.ownerDocument);
return container;
}
async onload(){\nawait super.onload();
this.register(()=>{for(const doc of this.imageLayoutDocuments){doc.off('click',this.imgSelector,this.clickImage);doc.off('mouseover',this.imgSelector,this.mouseoverImg);doc.off('mouseout',this.imgSelector,this.mouseoutImg);}this.imageLayoutDocuments.clear();});
this.noteImageStage=new addonModule.exports.default(this.app,this.manifest);\nthis.noteImageStage.host=this;
this.addChild(this.noteImageStage);\n}\n};\n})();\n`);
writeFileSync('styles.css',readFileSync('upstream/styles.css','utf8')+'\n'+readFileSync('sidebar.css','utf8'));
