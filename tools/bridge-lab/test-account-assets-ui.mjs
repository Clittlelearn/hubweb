import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = process.env.HUB_TEST_ORIGIN || 'http://192.168.1.14:8848';
const account = '0x755Ccf704E17570b64E247f0794314e4C8E542CA';
const asset = '0x' + 'a'.repeat(64), contract = '0x' + 'b'.repeat(40);
const output = new URL('test-results/account-assets/', import.meta.url);
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', route => {
  const req=route.request(), url=new URL(req.url());
  if (req.method() !== 'GET') return route.fulfill({json:{jsonrpc:'2.0',id:1,result:null}});
  if (url.origin===origin && !url.pathname.startsWith('/api/v1/')) return route.continue();
  let data={list:[],balances:[],total:0};
  if (url.pathname.includes('/balances/')) data={balances:[
    {asset_type:'OHI',balance:'10000000000'}, {asset_type:asset,balance:'1000000000000'}]};
  if (url.pathname.endsWith('/erc20-balances')) data={balances:[{contract_address:contract,balance:'2000000000000000000'}]};
  if (url.pathname.endsWith('/assets/catalog')) data={metadata_supported:true,list:[
    {kind:'proposal',asset_type:asset,name:btoa('High Balance'),symbol:btoa('HIGH'),is_added:true,is_native_flow_active:true},
    {kind:'erc20',asset_id:contract,contract_address:contract,name:'Small ERC20',symbol:'SMALL',decimals:18,is_added:true}]};
  if (url.pathname.endsWith('/metadata')) data={name:'Small ERC20',symbol:'SMALL',decimals:18};
  return route.fulfill({json:{code:0,data}});
});
await page.addInitScript(({account})=> {
  Object.defineProperty(window,'ethereum',{value:{isMetaMask:true,on(){},removeListener(){},
    async request({method}) {
      if(method==='eth_chainId')return '0x301b';
      if(['eth_accounts','eth_requestAccounts'].includes(method))return [account];
      if(['wallet_getPermissions','wallet_requestPermissions'].includes(method))return [{parentCapability:'eth_accounts'}];
      throw new Error('Signing forbidden: '+method);
    }}});
},{account});
try {
  await page.goto(origin+'/wallet');
  await page.getByRole('button',{name:/^Connect Wallet$/}).last().click();
  await page.getByRole('button',{name:/Browser Wallet/}).click();
  const header=page.getByRole('button',{name:'Connected wallet account'});
  await expect(header).toContainText('0x755C');
  await expect(header).not.toContainText('%');
  await expect(page.getByText('Small ERC20',{exact:true})).toBeVisible();
  const tokenNames=page.locator('main p.font-medium').filter({hasText:/^(High Balance|HiveX|Small ERC20)$/});
  assert.deepEqual(await tokenNames.allTextContents(),['High Balance','HiveX','Small ERC20']);
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByRole('button',{name:/Select token/}).click();
  const options=page.getByRole('button').filter({hasText:/High Balance|Small ERC20|HiveX.*OHI/});
  assert.equal(await options.count(),3);
  assert.match((await options.allTextContents())[0],/High Balance/);
  assert.match((await options.allTextContents())[2],/Small ERC20/);
  await options.first().click();
  await page.getByRole('button',{name:'Close transfer',exact:true}).click();
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
    await page.setViewportSize({width,height});
    await expect(header).toContainText('0x755C');
    await page.screenshot({path:new URL(name+'.png',output).pathname,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/validators');
  await expect(header).toContainText('0x755C');
  const selected=page.getByRole('button',{name:/High Balance/});
  await expect(selected).toBeVisible();
  await selected.click();
  const list=selected.locator('..').locator('button');
  const labels=await list.allTextContents();
  assert.match(labels[1],/High Balance/);
  assert.match(labels[2],/HiveX/);
  await page.screenshot({path:new URL('validators.png',output).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('LAN: account address, wallet/transfer/delegation balance ordering, desktop/mobile passed. No transactions.');
} finally {await browser.close();}
