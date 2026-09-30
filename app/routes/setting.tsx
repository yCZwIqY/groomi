import TrashNode from '~/features/settings/trash-node/trash-node';
import AiSetting from '~/features/settings/ai-setting/ai-setting';
import CommentStyleExampleSetting from '~/features/settings/ai-setting/comment-style-example-setting';
import WorkspaceBackup from '~/features/settings/workspace-backup';

const Setting = () => {
  return (
    <div className={'mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-10'}>
      <div className={'pb-2'}>
        <h1 className={'text-xl font-bold text-neutral-800'}>설정</h1>
        <p className={'mt-1 text-sm text-neutral-400'}>
          작업 환경과 AI 기능에 필요한 항목을 관리합니다.
        </p>
      </div>
      <div className={'grid items-start gap-5 xl:grid-cols-2'}>
        <AiSetting />
        <TrashNode />
      </div>
      <CommentStyleExampleSetting />
      <WorkspaceBackup />
    </div>
  );
};

export default Setting;
