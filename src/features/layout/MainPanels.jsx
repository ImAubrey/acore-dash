import { DashboardPanel } from '../dashboard/DashboardPanel';
import { ConnectionsPanel } from '../connections/ConnectionsPanel';
import { NodesPanel } from '../nodes/NodesPanel';
import { SubscriptionsPanel } from '../subscriptions/SubscriptionsPanel';
import { InboundsPanel } from '../inbounds/InboundsPanel';
import { RulesPanel } from '../rules/RulesPanel';
import { FirewallPanel } from '../firewall/FirewallPanel';
import { LogsPanel } from '../logs/LogsPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { AppModals } from '../modals/AppModals';

export function MainPanels({
  dashboardPanelProps,
  connectionsPanelProps,
  nodesPanelProps,
  subscriptionsPanelProps,
  inboundsPanelProps,
  rulesPanelProps,
  firewallPanelProps,
  logsPanelProps,
  settingsPanelProps,
  appModalsProps
}) {
  return (
    <>
      <section className="content">
        <DashboardPanel {...dashboardPanelProps} />
        <ConnectionsPanel {...connectionsPanelProps} />
        <NodesPanel {...nodesPanelProps} />
        <SubscriptionsPanel {...subscriptionsPanelProps} />
        <InboundsPanel {...inboundsPanelProps} />
        <RulesPanel {...rulesPanelProps} />
        <FirewallPanel {...firewallPanelProps} />
        <LogsPanel {...logsPanelProps} />
        <SettingsPanel {...settingsPanelProps} />
      </section>
      <AppModals {...appModalsProps} />
    </>
  );
}
