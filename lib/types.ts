export interface Tag {
  id: string;
  user_id?: string;
  name: string;
  category: "organism" | "reagent" | "technique" | "equipment" | "other";
  color: string;
  created_at?: string;
}

export interface Experiment {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  researcher_name?: string;
  protocol?: string;
  status?: "planning" | "in_progress" | "completed" | "on_hold";
  visibility?: string;
  created_at: string;
  updated_at?: string;
  tags: any[];
  protocols: any[];
  files: any[];
  results: any[];
}
