export type SvFila = {
  sid: string;
  roles: string[];
  aus?: boolean;
  nota?: string;
};

export type SvReunionBase = {
  id: string;
  nombre: string;
  fecha: string;
  seccion: string;
  origen: "asana" | "manual";
  fuera_de_asana?: boolean;
};

export type SvServidor = {
  id: string;
  nombre: string;
  di?: string | null;
};

export type SvGrupo = {
  id: string;
  nombre: string;
  lider: string;
  lider_user_ids: string[];
};

export type SvMiembro = {
  id: string;
  nombre: string;
  grupo_id: string;
};

export type SvServicioItem = {
  di: string;
  f: string;
  r: string;
  u: string;
  t: "min" | "serv";
  aus: boolean;
  rid: string;
  roles: string[];
};

export type SvDiscipuloFila = {
  id: string;
  n: string;
  min: number;
  serv: number;
  aus: number;
  det: SvServicioItem[];
};

export type SvRegistro = {
  cuando: string;
  por: string;
  nota: string;
  filas: SvFila[];
};

export type SvData = {
  reuniones: Record<string, SvReunionBase>;
  servidores: Record<string, SvServidor>;
  registros: Record<string, SvRegistro>;
  sync: number;
  sync_error: string;
  grupos: Record<string, SvGrupo>;
  miembros: Record<string, SvMiembro>;
};

export type SvReunionUI = SvReunionBase & {
  u: string;
  tipo: "min" | "serv";
  cargada: boolean;
  cuando: string | null;
  nota: string;
  filas: SvFila[];
};

export type SvConteoEntry = {
  u: Set<string>;
  min: Set<string>;
  serv: Set<string>;
  aus: Set<string>;
  roles: Set<string>;
  ult: string;
  reus: Array<{ r: SvReunionUI; roles: string[]; aus: boolean; nota: string }>;
};

export type SvPer = "mes" | "trimestre" | "semestre" | "anio";
