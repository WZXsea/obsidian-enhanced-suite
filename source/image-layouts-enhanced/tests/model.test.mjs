import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const output = await build({entryPoints:[fileURLToPath(new URL('../src/model.ts',import.meta.url))],bundle:true,format:'esm',platform:'node',write:false});
const {parseGroups,normalizeOptions,serializeOpen,wrapSelection,updateGroup,unwrapGroup,parseCustomGrid} = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
const open = options => `<!-- image-layouts: ${JSON.stringify(options)} -->`;
const close = '<!-- /image-layouts -->';
const edit = (source,patch) => source.slice(0,patch.from)+patch.insert+source.slice(patch.to);

test('parses separate groups with exact source ranges, UTF16 offsets and CRLF line positions',()=>{
  const first = [open({id:'first',layout:'filmstrip'}),'![[一.png]] ![[一.png]]',close].join('\r\n');
  const second = [open({id:'second',layout:'focus'}),'![two](https://host/two.png)',close].join('\r\n');
  const source = `😀 introduction\r\n${first}\r\nCaption\r\n${second}\r\nend`;
  const groups = parseGroups(source);
  assert.equal(groups.length,2);
  assert.equal(groups[0].from,'😀 introduction\r\n'.length);
  assert.equal(groups[0].startLine,1);
  assert.equal(groups[0].endLine,3);
  assert.equal(groups[1].startLine,5);
  for(const group of groups){assert.equal(source.slice(group.from,group.to),group.raw);assert.equal(source.slice(group.bodyFrom,group.bodyTo),group.body);}
  assert.equal(groups[0].body,'![[一.png]] ![[一.png]]\r\n');
});

test('frontmatter, code fences, normal comments and inline fake markers retain native source',()=>{
  const pair = [open({layout:'a'}),'![[a.png]]',close].join('\n');
  const source = ['---','caption: |',...pair.split('\n'),'---','```md',pair,'```','~~~',pair,'~~~','<!-- ordinary',pair,'-->','text '+open({layout:'a'}),'![[a.png]]',close,pair].join('\n');
  const groups = parseGroups(source);
  assert.equal(groups.length,1);
  assert.equal(groups[0].from,source.lastIndexOf(open({layout:'a'})));
});

test('nested, malformed JSON, dangerous raw delimiters and unclosed groups retain native body',()=>{
  const nested = [open({}),open({}),'![[a.png]]',close,close].join('\n');
  assert.deepEqual(parseGroups(nested),[]);
  assert.deepEqual(parseGroups([open({}),'![[a.png]]'].join('\n')),[]);
  assert.deepEqual(parseGroups(['<!-- image-layouts: invalid -->','![[a.png]]',close].join('\n')),[]);
  assert.deepEqual(parseGroups([open({caption:'before --> after'}),'![[a.png]]',close].join('\n')),[]);
  assert.deepEqual(parseGroups(['    '+open({}),'![[a.png]]','    '+close].join('\n')),[]);
});

test('fenced and commented marker examples inside group body remain literal content',()=>{
  const source = [open({layout:'focus'}),'```md',close,'```','<!-- example',open({}), '-->', '![[a.png]]',close].join('\n');
  const groups = parseGroups(source);
  assert.equal(groups.length,1);
  assert.equal(groups[0].options.layout,'focus');
  assert.equal(groups[0].endLine,8);
});

test('marker examples inside multiline inline code and comment text retain native semantics',()=>{
  const pair = [open({layout:'a'}),'![[a.png]]',close].join('\n');
  const source = `Description \`example\n${pair}\n\` ends.\n\n${pair}`;
  assert.equal(parseGroups(source).length,1);
  assert.equal(parseGroups(source)[0].from,source.lastIndexOf(open({layout:'a'})));
  const commentInCode = `\`<!-- literal\`\n\n${pair}`;
  assert.equal(parseGroups(commentInCode).length,1);
});

test('markers inside nested HTML code containers retain native source',()=>{
  const pair = [open({layout:'a'}),'![[a.png]]',close].join('\n');
  const source = `<pre><code>\n${pair}\n</code></pre>\n<script>\n${pair}\n</script>\n${pair}`;
  assert.equal(parseGroups(source).length,1);
  assert.equal(parseGroups(source)[0].from,source.lastIndexOf(open({layout:'a'})));
});

test('normalization uses upstream aliases, canonical precedence and safe CSS dimensions',()=>{
  const options = normalizeOptions({layout:'legacy-layout-f',carouselShowThumbnails:false,carouselHeight:'450px',fit:'cover',width:'70%',permanentOverlay:true,limit:8.8});
  assert.equal(options.layout,'f');assert.equal(options.thumbnails,false);assert.equal(options.height,450);assert.equal(options.width,'70%');assert.equal(options.overlay,'always');assert.equal(options.limit,8);
  assert.equal(normalizeOptions({height:420,carouselHeight:700,thumbnails:false,carouselShowThumbnails:true}).height,420);
  assert.equal(normalizeOptions({height:420,carouselHeight:700,thumbnails:false,carouselShowThumbnails:true}).thumbnails,false);
  for(const width of ['url(javascript:x)','1px;display:none','calc(10px)','var(--bad)','Infinitypx','-2px'])assert.equal(normalizeOptions({width}).width,'100%');
  assert.equal(normalizeOptions({width:'500%'}).width,'100%');
  assert.equal(normalizeOptions({height:Infinity,gap:-2,radius:999}).height,320);
  assert.equal(normalizeOptions({height:Infinity,gap:-2,radius:999}).gap,0);
  assert.equal(normalizeOptions({height:Infinity,gap:-2,radius:999}).radius,48);
  assert.equal(normalizeOptions({layout:'masonry4'}).layout,'masonry-4');
  assert.deepEqual(normalizeOptions({descriptions:['A',null,'C']}).descriptions,['A','','C']);
});

test('serialized JSON keeps comment delimiters inert and roundtrips display text',()=>{
  const caption = 'a --> b <!-- <script> & \u2028';
  const marker = serializeOpen({caption,layout:'carousel'});
  assert.equal(marker.slice(4,-3).includes('-->'),false);
  assert.equal(marker.slice(4,-3).includes('<!--'),false);
  assert.equal(parseGroups(`${marker}\n![[a.png]]\n${close}`)[0].options.caption,caption);
});

test('markers store only layout, identity and nondefault values while keeping all display semantics',()=>{
  assert.equal(serializeOpen({layout:'focus',id:'123456abcd'}),'<!-- image-layouts: {"layout":"focus","id":"123456abcd"} -->');
  const options=normalizeOptions({layout:'g',id:'old-uuid-is-preserved',height:380,caption:'图注',descriptions:['A','B'],thumbnails:false,fromFolder:'images',reverse:true});
  const marker=serializeOpen(options);
  assert.ok(!marker.includes('"fit"'));
  assert.ok(!marker.includes('"gap"'));
  assert.ok(!marker.includes('"width"'));
  assert.deepEqual(parseGroups(`${marker}\n![[a.png]]\n${close}`)[0].options,options);
  const all=normalizeOptions({fit:'natural',height:640,gap:12,radius:0,grid:'AB',overlay:'always',align:'left',width:'50%',sortBy:'mtime',limit:3});
  assert.deepEqual(parseGroups(`${serializeOpen(all)}\n![[a.png]]\n${close}`)[0].options,all);
});

test('wrapSelection preserves selected raw text and creates independent marker lines',()=>{
  const source = 'before ![[一.png]] ![B](b.png) after';
  const from = source.indexOf('!');const to = source.indexOf(' after');
  const wrapped = edit(source,wrapSelection(source,from,to,{layout:'filmstrip'}));
  assert.equal(parseGroups(wrapped).length,1);
  assert.equal(parseGroups(wrapped)[0].body,source.slice(from,to)+'\n');
  assert.ok(wrapped.startsWith('before \n<!-- image-layouts:'));
  assert.ok(wrapped.endsWith(`${close}\n after`));
  const crlf = '![[a.png]]\r\ncaption';
  assert.ok(wrapSelection(crlf,0,10,{layout:'focus'}).insert.includes('\r\n'));
  assert.equal(wrapSelection('😀',1,2,{}),null);
  assert.equal(wrapSelection('a\r\nb',0,2,{}),null);
  assert.equal(wrapSelection(source,-1,4,{}),null);
  assert.equal(wrapSelection(source,1,1,{}),null);
});

test('wrapping existing or selected markers rejects ambiguous nesting',()=>{
  const source = [open({}),'![[a.png]]',close].join('\n');
  const group = parseGroups(source)[0];
  assert.equal(wrapSelection(source,group.bodyFrom,group.bodyTo,{}),null);
  assert.equal(wrapSelection(source,0,source.length,{}),null);
});

test('wrapping complete paragraphs and unwrapping restores existing outside blank lines exactly',()=>{
  for(const eol of ['\n','\r\n']){
    const body=`![[a.png]]${eol}${eol}图注保留。${eol}`;
    const source=`开头。${eol}${eol}${body}${eol}结尾。${eol}`;
    const from=source.indexOf(body),to=from+body.length;
    const wrapped=edit(source,wrapSelection(source,from,to,{id:'short',layout:'focus'}));
    assert.equal(edit(wrapped,unwrapGroup(wrapped,parseGroups(wrapped)[0])),source);
  }
});

test('wrapSelection checks Markdown context and retains native code/comment/frontmatter examples',()=>{
  for(const source of ['```md\n![[a.png]]\n```','<!-- example\n![[a.png]]\n-->','---\ncaption: ![[a.png]]\n---']) {
    const from = source.indexOf('![[a.png]]');
    assert.equal(wrapSelection(source,from,from+'![[a.png]]'.length,{}),null);
  }
});

test('update edits only opening line and unwrap keeps captions/body bytes',()=>{
  const source = `heading\r\n${open({id:'group',layout:'a'})}\r\n![[a.png]]\r\nFigure 1 caption.\r\n${close}\r\nfooter`;
  const group = parseGroups(source)[0];
  const patch = updateGroup(source,group,{layout:'focus',caption:'Group caption'});
  const updated = edit(source,patch);
  const current = parseGroups(updated)[0];
  assert.equal(current.options.layout,'focus');assert.equal(current.options.id,'group');
  assert.equal(current.body,group.body);
  assert.equal(patch.to,source.indexOf('\r\n',group.from));
  assert.equal(edit(source,unwrapGroup(source,group)),`heading\r\n${group.body}footer`);
  const changed = source.slice(0,group.bodyFrom)+'edited '+source.slice(group.bodyFrom);
  assert.equal(updateGroup(changed,group,{layout:'g'}),null);
  assert.equal(unwrapGroup(changed,group),null);
});

test('custom grids map first-seen letters to safe slots and validate rectangular regions',()=>{
  assert.deepEqual(parseCustomGrid('A A B\nA A C'),{areas:'"image-0 image-0 image-1" "image-0 image-0 image-2"',columns:3,slots:3});
  assert.deepEqual(parseCustomGrid('ZZx\nZZ.'),{areas:'"image-0 image-0 image-1" "image-0 image-0 ."',columns:3,slots:2});
  for(const grid of ['', '...', 'AB\nA', 'AAB\nABA', 'A\"B','A A\nA .'])assert.ok('error' in parseCustomGrid(grid),grid);
});
