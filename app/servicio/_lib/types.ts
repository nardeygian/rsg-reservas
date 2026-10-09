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
