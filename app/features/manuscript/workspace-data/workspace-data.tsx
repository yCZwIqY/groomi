import { useEffect, useState } from 'react';
import {
  getWorkspaceInfo,
  getWorkspaceTree,
  onWorkspaceTreeChanged,
} from '~/lib/electron/workspace-api';
import { useSelectedWorkspace } from '~/stores/use-selected-workspace';
import DnButton from '~/components/common/buttons/dn-button';
import AddWorkspaceButton from '~/components/add-workspace-modal/add-workspace-button';
import WorkspaceList from '~/features/manuscript/workspace-data/workspace-list';
import WorkspaceTabs from '~/features/manuscript/workspace-data/workspace-tabs';
import WorkspaceSummary from '~/features/manuscript/workspace-data/workspace-summary';
import { WorkspaceBreadcrumb } from '~/features';

const WorkspaceData = () => {
  const selectedWorkspace = useSelectedWorkspace((state) => state.selectedWorkspace);
  const setSelectedWorkspace = useSelectedWorkspace((state) => state.setSelectedWorkspace);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceNode | null>(null);
  const [tree, setTree] = useState<WorkspaceNode[]>([]);

  const loadWorkspaceTree = async (targetPath?: string) => {
    if (!targetPath) {
      setTree([]);
      return;
    }

    const nextTree = await getWorkspaceTree(targetPath);
    setTree(nextTree?.[0]?.children ?? []);
  };

  useEffect(() => {
    if (!selectedWorkspace?.path) {
      setWorkspaceData(null);
      setTree([]);
      return;
    }

    let isMounted = true;

    const syncWorkspaceData = async () => {
      const data = await getWorkspaceInfo(selectedWorkspace.path);

      if (isMounted && data) {
        setWorkspaceData(data);
      }
    };

    const syncWorkspaceTree = async () => {
      const nextTree = await getWorkspaceTree(selectedWorkspace.path);

      if (isMounted) {
        setTree(nextTree?.[0]?.children ?? []);
      }
    };

    void syncWorkspaceData();
    void syncWorkspaceTree();

    const unsubscribe = onWorkspaceTreeChanged(() => {
      void syncWorkspaceTree();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [selectedWorkspace?.id, selectedWorkspace?.path]);

  return (
    <div className={'flex flex-col flex-1 p-8 gap-4'}>
      <WorkspaceBreadcrumb />
      <WorkspaceSummary
        workspaceData={workspaceData}
        onUpdated={(nextWorkspaceData) => {
          setWorkspaceData(nextWorkspaceData);
          setSelectedWorkspace(nextWorkspaceData);
        }}
      />
      <div className={'flex justify-end'}>
        <AddWorkspaceButton
          onCreated={() => {
            void loadWorkspaceTree(selectedWorkspace?.path);
          }}
          targetPath={selectedWorkspace?.path}
        >
          <DnButton>추가하기</DnButton>
        </AddWorkspaceButton>
      </div>
      {workspaceData?.workspace?.novelType === 'long' ? (
        <WorkspaceTabs
          groupPath={workspaceData.path}
          tree={tree}
        />
      ) : (
        <WorkspaceList tree={tree} />
      )}
    </div>
  );
};

export default WorkspaceData;
