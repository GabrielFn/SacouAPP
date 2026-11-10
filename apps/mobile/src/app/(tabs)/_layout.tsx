import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";

import { groupsHref, homeHref, meHref } from "../../features/groups/navigation";
import { strings } from "../../strings/pt-BR";
import { GroupIcon, HomeIcon, PersonIcon } from "../../ui/Icons";
import { TabBarFrame, TabBarItem } from "../../ui/TabBar";

const { tabs } = strings.groups;

/** Início, Grupo and Eu: the headless tabs of the router with the bar of the canvas (ADR 0044). */
export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <TabBarFrame>
          <TabTrigger name="index" href={homeHref} asChild>
            <TabBarItem label={tabs.home} renderIcon={(color) => <HomeIcon color={color} />} />
          </TabTrigger>
          <TabTrigger name="groups" href={groupsHref} asChild>
            <TabBarItem label={tabs.groups} renderIcon={(color) => <GroupIcon color={color} />} />
          </TabTrigger>
          <TabTrigger name="me" href={meHref} asChild>
            <TabBarItem label={tabs.me} renderIcon={(color) => <PersonIcon color={color} />} />
          </TabTrigger>
        </TabBarFrame>
      </TabList>
    </Tabs>
  );
}
