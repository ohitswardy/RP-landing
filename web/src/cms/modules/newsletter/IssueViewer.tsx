import { useState } from 'react';
import { BtnGhost, BtnPrimary } from '../../ui';
import { Modal } from '../../kit/parts';
import { IconDownload, IconPen } from '../../icons';
import { fmtDate, type NewsletterIssue } from '../../data';
import TemplatePreview from './TemplatePreview';
import { downloadIssuePdf, type PrintActor } from './printIssue';

/** Read-only look at a filed issue, exactly as the mailer prints it. */
export default function IssueViewer({ issue, actor, onEdit, onClose }: {
  issue: NewsletterIssue;
  actor: PrintActor;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [preparing, setPreparing] = useState(false);

  async function download() {
    setPreparing(true);
    try {
      await downloadIssuePdf(issue, actor);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <Modal
      open
      title={`${issue.subject} · ${fmtDate(issue.date)}`}
      onClose={onClose}
      wide
      footer={
        <>
          <BtnGhost onClick={onEdit}><IconPen size={13} /> Edit issue</BtnGhost>
          <BtnPrimary onClick={() => { void download(); }} disabled={preparing}>
            <IconDownload size={14} /> {preparing ? 'Preparing PDF…' : 'Download PDF'}
          </BtnPrimary>
        </>
      }
    >
      <div className="mx-auto max-w-[700px] border rule shadow-sm">
        <TemplatePreview
          cadence={issue.cadence}
          date={issue.date}
          subject={issue.subject}
          intro={issue.intro}
          sections={issue.sections}
        />
      </div>
      <p className="mx-auto mt-4 max-w-[700px] text-[11.5px] leading-relaxed text-graphite">
        Downloads carry the REGIS watermark on every page, along with a download reference and the
        name of the person who downloaded it. The mailer itself goes out unmarked.
      </p>
    </Modal>
  );
}
