import { call } from './invoke';
import type { AnnotationDto, AnnotationInput, NewRecordInput, ReviewRecordDto } from '../types';

export const recordService = {
  createRecord(projectId: string, input: NewRecordInput) {
    return call<ReviewRecordDto>('create_record', { projectId, input });
  },
  updateRecord(projectId: string, recordId: string, input: NewRecordInput) {
    return call<ReviewRecordDto>('update_record', {
      projectId,
      recordId,
      input,
    });
  },
  deleteRecord(projectId: string, recordId: string) {
    return call<void>('delete_record', { projectId, recordId });
  },
  copyRecord(projectId: string, recordId: string) {
    return call<ReviewRecordDto>('copy_record', { projectId, recordId });
  },
  listRecords(projectId: string, sortMode?: string, sortDirection?: string) {
    return call<ReviewRecordDto[]>('list_records', {
      projectId,
      sortMode,
      sortDirection,
    });
  },
  getAnnotations(projectId: string, recordId: string) {
    return call<AnnotationDto[]>('get_annotations', { projectId, recordId });
  },
  replaceAnnotations(projectId: string, recordId: string, annotations: AnnotationInput[]) {
    return call<AnnotationDto[]>('replace_annotations', {
      projectId,
      recordId,
      annotations,
    });
  },
  saveThumbnail(projectId: string, recordId: string, version: number, dataBase64: string) {
    return call<string>('save_thumbnail', {
      projectId,
      recordId,
      version,
      dataBase64,
    });
  },
};
