import React from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import CustomRuleEditor from './CustomRuleEditor';
import { securityRulesApi } from '../../services/api';

jest.mock('../../services/api', () => ({ securityRulesApi: { createCustomRule: jest.fn() } }));
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test('creating a rule preserves the default log source when its tab was never opened', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const saved = jest.fn();
  (securityRulesApi.createCustomRule as jest.Mock).mockResolvedValue({ success: true });
  await act(async () => { root.render(<CustomRuleEditor visible mode="create" onCancel={() => {}} onSuccess={saved} />); });
  const fill = async (id: string, value: string) => act(async () => {
    const element = document.getElementById(id) as HTMLInputElement;
    Simulate.change(element, { target: { value } } as any);
  });
  await fill('title', '异常登录检测');
  await fill('author', '管理员');
  await act(async () => { (document.querySelector('[data-node-key="detection"] .ant-tabs-tab-btn') as HTMLElement).click(); });
  await fill('detection_selection', 'message|contains: 登录失败');
  await act(async () => { (document.querySelector('.ant-modal button.ant-btn-primary') as HTMLElement).click(); });
  expect(securityRulesApi.createCustomRule).toHaveBeenCalledWith(expect.objectContaining({
    logsource: { product: 'windows' }, enabled: true,
    detection: { selection: { 'message|contains': '登录失败' }, condition: 'selection' }
  }));
  expect(saved).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  container.remove();
}, 20000);
