import { BtnGhost, BtnPrimary } from '../../ui';
import { Modal } from '../../kit/parts';
import { IconExternal, IconMail, IconPen } from '../../icons';
import { fmtDate, type NewsletterIssue } from '../../data';
import TemplatePreview from './TemplatePreview';
import { openIssueHtml } from './emailHtml';

/** Read-only look at a filed issue, exactly as the mailer prints it. */
export default function IssueViewer({ issue, onEdit, onBlast, onClose }: {
  issue: NewsletterIssue;
  onEdit: () => void;
  onBlast: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title={`${issue.subject} · ${fmtDate(issue.date)}`}
      onClose={onClose}
      wide
      footer={
        <>
          <BtnGhost onClick={onEdit}><IconPen size={13} /> Edit issue</BtnGhost>
          <BtnGhost onClick={() => openIssueHtml(issue)}><IconExternal size={13} /> View HTML</BtnGhost>
          <BtnPrimary onClick={onBlast}><IconMail size={14} /> Email blast</BtnPrimary>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[700px] overflow-x-auto border rule bg-white shadow-sm">
        <div className="min-w-[560px]">
          <TemplatePreview
            cadence={issue.cadence}
            date={issue.date}
            subject={issue.subject}
            intro={issue.intro}
            sections={issue.sections}
            rail={issue.rail}
          />
        </div>
      </div>
      <p className="mono mx-auto mt-4 max-w-[700px] text-[10px] uppercase leading-relaxed tracking-[0.12em] text-silver">
        {issue.sections.length === 1 ? '1 section' : `${issue.sections.length} sections`} · scroll for the full mailer
      </p>
      <p className="mx-auto mt-2 max-w-[700px] text-[11.5px] leading-relaxed text-graphite">
        The mailer goes out as HTML, exactly as previewed here. Email blast copies it for the
        Outlook compose window or queues it in the Email desk.
      </p>
    </Modal>
  );
}
