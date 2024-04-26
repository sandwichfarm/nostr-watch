export type Job = {
  id: string,
  type: string,
  data: any,
  status: string,
  created_at: Date,
  updated_at: Date,
  completed_at: Date,
  error: string,
  result: any
}