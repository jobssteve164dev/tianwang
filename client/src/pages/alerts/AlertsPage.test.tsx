import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { App } from 'antd';
import AlertsPage from './AlertsPage';
import alert from '../../store/slices/alertSlice';
Object.defineProperty(window,'matchMedia',{value:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

test('confirming an alert calls persistence and a rejected save cannot change its status',async()=>{
 const fixture={id:'fixture',title:'异常登录',type:'authentication-anomaly',severity:'high',status:'active',source:'设备监测',timestamp:new Date().toISOString()};
 global.fetch=jest.fn(async(_url,options)=>options?.method==='PATCH'?{ok:false,json:async()=>({message:'保存失败'})}:{ok:true,json:async()=>({success:true,data:{alerts:[fixture]}})}) as any;
 const store=configureStore({reducer:{alert}});const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 await act(async()=>{root.render(<Provider store={store}><App><AlertsPage/></App></Provider>)});
 await act(async()=>{(document.querySelector('button .anticon-eye')?.closest('button') as HTMLElement).click()});
 await act(async()=>{(Array.from(document.querySelectorAll('.ant-modal button')).find(x=>x.textContent?.includes('确认告警')) as HTMLElement).click()});
 expect(global.fetch).toHaveBeenCalledWith('/api/alerts/fixture/status',expect.objectContaining({method:'PATCH',body:JSON.stringify({status:'acknowledged'})}));
 expect(store.getState().alert.alerts[0].status).toBe('active');
 expect(document.body.textContent).not.toContain('告警状态已更新');
 await act(async()=>root.unmount());host.remove();
}, 20000);
