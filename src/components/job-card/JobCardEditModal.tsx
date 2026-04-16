import type { Job } from '@/types';
import { JobCardEditOverlay } from './JobCardEditOverlay';

interface JobCardEditModalProps {
  isOpen: boolean;
  jobs: Job[] | null;
  onClose: () => void;
  onSave?: () => void;
}

export function JobCardEditModal({ isOpen, jobs, onClose, onSave }: JobCardEditModalProps) {
  return <JobCardEditOverlay isOpen={isOpen} jobs={jobs} onClose={onClose} onSave={onSave} />;
}
