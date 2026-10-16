export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      avatars: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          is_active: boolean;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          color: string;
          created_at?: string;
          id: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      category_translations: {
        Row: {
          category_id: string;
          locale: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          locale: string;
          name: string;
        };
        Update: {
          category_id?: string;
          locale?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      guests: {
        Row: {
          avatar_id: string;
          created_at: string;
          id: string;
          last_used_at: string;
          name: string;
          owner_id: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_id: string;
          created_at?: string;
          id?: string;
          last_used_at?: string;
          name: string;
          owner_id?: string;
        };
        Update: {
          avatar_id?: string;
          created_at?: string;
          id?: string;
          last_used_at?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guests_avatar_id_fkey";
            columns: ["avatar_id"];
            isOneToOne: false;
            referencedRelation: "avatars";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_id: string;
          created_at: string;
          id: string;
          locale: string;
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_id: string;
          created_at?: string;
          id: string;
          locale: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_id?: string;
          created_at?: string;
          id?: string;
          locale?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_id_fkey";
            columns: ["avatar_id"];
            isOneToOne: false;
            referencedRelation: "avatars";
            referencedColumns: ["id"];
          },
        ];
      };
      question_translations: {
        Row: {
          answers: string[];
          locale: string;
          prompt: string;
          question_id: string;
        };
        ComputedFields: never;
        Insert: {
          answers: string[];
          locale: string;
          prompt: string;
          question_id: string;
        };
        Update: {
          answers?: string[];
          locale?: string;
          prompt?: string;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_translations_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          category_id: string;
          created_at: string;
          difficulty: string;
          external_id: string;
          id: string;
          source: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          difficulty: string;
          external_id: string;
          id?: string;
          source: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          difficulty?: string;
          external_id?: string;
          id?: string;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      quick_match_players: {
        Row: {
          avatar_id: string;
          match_id: string;
          name: string;
          seat: number;
        };
        ComputedFields: never;
        Insert: {
          avatar_id: string;
          match_id: string;
          name: string;
          seat: number;
        };
        Update: {
          avatar_id?: string;
          match_id?: string;
          name?: string;
          seat?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quick_match_players_avatar_id_fkey";
            columns: ["avatar_id"];
            isOneToOne: false;
            referencedRelation: "avatars";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quick_match_players_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "quick_matches";
            referencedColumns: ["id"];
          },
        ];
      };
      quick_match_rounds: {
        Row: {
          answer_order: number[];
          answered_at: string | null;
          chosen: number | null;
          is_correct: boolean | null;
          match_id: string;
          points: number | null;
          position: number;
          question_id: string;
          served_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          answer_order: number[];
          answered_at?: string | null;
          chosen?: number | null;
          is_correct?: boolean | null;
          match_id: string;
          points?: number | null;
          position: number;
          question_id: string;
          served_at?: string | null;
        };
        Update: {
          answer_order?: number[];
          answered_at?: string | null;
          chosen?: number | null;
          is_correct?: boolean | null;
          match_id?: string;
          points?: number | null;
          position?: number;
          question_id?: string;
          served_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quick_match_rounds_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "quick_matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quick_match_rounds_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quick_matches: {
        Row: {
          created_at: string;
          difficulty: string;
          finished_at: string | null;
          id: string;
          locale: string;
          owner_id: string;
          player_count: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          difficulty: string;
          finished_at?: string | null;
          id?: string;
          locale: string;
          owner_id: string;
          player_count: number;
        };
        Update: {
          created_at?: string;
          difficulty?: string;
          finished_at?: string | null;
          id?: string;
          locale?: string;
          owner_id?: string;
          player_count?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      answer_quick_question: {
        Args: { choice: number; match_id: string; question_position: number };
        Returns: Json;
      };
      delete_own_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      get_quick_match: { Args: { match_id: string }; Returns: Json };
      import_questions: { Args: { items: Json }; Returns: number };
      is_username_available: { Args: { candidate: string }; Returns: boolean };
      remember_guest: {
        Args: { guest_avatar_id: string; guest_name: string };
        Returns: {
          avatar_id: string;
          created_at: string;
          id: string;
          last_used_at: string;
          name: string;
          owner_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "guests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      serve_quick_question: { Args: { match_id: string }; Returns: Json };
      start_quick_match: {
        Args: { guest_ids?: string[]; match_difficulty: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
