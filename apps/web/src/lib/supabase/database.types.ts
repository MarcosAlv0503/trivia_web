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
      admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
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
      blocked_username_terms: {
        Row: {
          term: string;
        };
        ComputedFields: never;
        Insert: {
          term: string;
        };
        Update: {
          term?: string;
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
      duel_plays: {
        Row: {
          answer_order: number[];
          answered_at: string | null;
          chosen: number | null;
          duel_id: string;
          is_correct: boolean | null;
          locale: string;
          player_id: string;
          points: number | null;
          question_id: string;
          round: number;
          served_at: string | null;
          slot: number;
        };
        ComputedFields: never;
        Insert: {
          answer_order: number[];
          answered_at?: string | null;
          chosen?: number | null;
          duel_id: string;
          is_correct?: boolean | null;
          locale: string;
          player_id: string;
          points?: number | null;
          question_id: string;
          round: number;
          served_at?: string | null;
          slot: number;
        };
        Update: {
          answer_order?: number[];
          answered_at?: string | null;
          chosen?: number | null;
          duel_id?: string;
          is_correct?: boolean | null;
          locale?: string;
          player_id?: string;
          points?: number | null;
          question_id?: string;
          round?: number;
          served_at?: string | null;
          slot?: number;
        };
        Relationships: [
          {
            foreignKeyName: "duel_plays_duel_id_round_fkey";
            columns: ["duel_id", "round"];
            isOneToOne: false;
            referencedRelation: "duel_rounds";
            referencedColumns: ["duel_id", "round"];
          },
          {
            foreignKeyName: "duel_plays_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      duel_rounds: {
        Row: {
          category_id: string;
          created_at: string;
          duel_id: string;
          round: number;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          duel_id: string;
          round: number;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          duel_id?: string;
          round?: number;
        };
        Relationships: [
          {
            foreignKeyName: "duel_rounds_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "duel_rounds_duel_id_fkey";
            columns: ["duel_id"];
            isOneToOne: false;
            referencedRelation: "duels";
            referencedColumns: ["id"];
          },
        ];
      };
      duels: {
        Row: {
          challenger_id: string;
          created_at: string;
          deadline_warned_turn: number | null;
          difficulty: string;
          end_reason: string | null;
          finished_at: string | null;
          id: string;
          opponent_id: string;
          round_count: number;
          status: string;
          turn_deadline: string;
          turn_number: number;
          winner_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          challenger_id: string;
          created_at?: string;
          deadline_warned_turn?: number | null;
          difficulty: string;
          end_reason?: string | null;
          finished_at?: string | null;
          id?: string;
          opponent_id: string;
          round_count?: number;
          status?: string;
          turn_deadline?: string;
          turn_number?: number;
          winner_id?: string | null;
        };
        Update: {
          challenger_id?: string;
          created_at?: string;
          deadline_warned_turn?: number | null;
          difficulty?: string;
          end_reason?: string | null;
          finished_at?: string | null;
          id?: string;
          opponent_id?: string;
          round_count?: number;
          status?: string;
          turn_deadline?: string;
          turn_number?: number;
          winner_id?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          accepted_at: string | null;
          addressee_id: string;
          created_at: string;
          requester_id: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          addressee_id: string;
          created_at?: string;
          requester_id: string;
          status?: string;
        };
        Update: {
          accepted_at?: string | null;
          addressee_id?: string;
          created_at?: string;
          requester_id?: string;
          status?: string;
        };
        Relationships: [];
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
      notifications: {
        Row: {
          actor_name: string;
          created_at: string;
          duel_id: string | null;
          id: number;
          kind: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_name: string;
          created_at?: string;
          duel_id?: string | null;
          id?: never;
          kind: string;
          user_id: string;
        };
        Update: {
          actor_name?: string;
          created_at?: string;
          duel_id?: string | null;
          id?: never;
          kind?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_id: string;
          created_at: string;
          id: string;
          locale: string;
          terms_accepted_at: string;
          terms_version: number;
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_id: string;
          created_at?: string;
          id: string;
          locale: string;
          terms_accepted_at?: string;
          terms_version: number;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_id?: string;
          created_at?: string;
          id?: string;
          locale?: string;
          terms_accepted_at?: string;
          terms_version?: number;
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
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          p256dh: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      question_reports: {
        Row: {
          created_at: string;
          locale: string;
          question_id: string;
          reason: string;
          reporter_id: string;
          resolved_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          locale: string;
          question_id: string;
          reason: string;
          reporter_id: string;
          resolved_at?: string | null;
        };
        Update: {
          created_at?: string;
          locale?: string;
          question_id?: string;
          reason?: string;
          reporter_id?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_reports_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
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
          expires_at: string | null;
          external_id: string;
          id: string;
          needs_human: boolean;
          review_note: string | null;
          reviewed_at: string | null;
          source: string;
          status: string;
          topical: boolean;
          untranslatable: string[];
          updated_at: string;
          is_playable: boolean | null;
        };
        ComputedFields: "is_playable";
        Insert: {
          category_id: string;
          created_at?: string;
          difficulty: string;
          expires_at?: string | null;
          external_id: string;
          id?: string;
          needs_human?: boolean;
          review_note?: string | null;
          reviewed_at?: string | null;
          source: string;
          status?: string;
          topical?: boolean;
          untranslatable?: string[];
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          difficulty?: string;
          expires_at?: string | null;
          external_id?: string;
          id?: string;
          needs_human?: boolean;
          review_note?: string | null;
          reviewed_at?: string | null;
          source?: string;
          status?: string;
          topical?: boolean;
          untranslatable?: string[];
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
      rate_limits: {
        Row: {
          action: string;
          hits: number;
          user_id: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          hits: number;
          user_id: string;
          window_start: string;
        };
        Update: {
          action?: string;
          hits?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_review_question: {
        Args: { note?: string; question_id: string; verdict: string };
        Returns: undefined;
      };
      admin_review_queue: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_update_question: {
        Args: { question_difficulty: string; question_id: string; translations: Json };
        Returns: undefined;
      };
      answer_duel_question: {
        Args: { choice: number; duel_id: string; question_round: number; question_slot: number };
        Returns: Json;
      };
      answer_points: {
        Args: { elapsed_ms: number; hit: boolean; time_limit_ms: number };
        Returns: number;
      };
      answer_quick_question: {
        Args: { choice: number; match_id: string; question_position: number };
        Returns: Json;
      };
      are_friends: { Args: { a: string; b: string }; Returns: boolean };
      can_decline_duel: {
        Args: {
          d: Omit<
            Database["public"]["Tables"]["duels"]["Row"],
            Database["public"]["Tables"]["duels"]["ComputedFields"]
          >;
          uid: string;
        };
        Returns: boolean;
      };
      check_rate_limit: {
        Args: { limited_action: string; max_hits: number; per: string };
        Returns: undefined;
      };
      current_player_id: { Args: Record<PropertyKey, never>; Returns: string };
      decline_duel: { Args: { duel_id: string }; Returns: undefined };
      delete_own_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      delete_push_subscription: { Args: { sub_endpoint: string }; Returns: undefined };
      duel_candidates: {
        Args: {
          locale_a: string;
          locale_b: string;
          target: Omit<
            Database["public"]["Tables"]["duels"]["Row"],
            Database["public"]["Tables"]["duels"]["ComputedFields"]
          >;
        };
        Returns: {
          category_id: string;
          question_id: string;
        }[];
      };
      duel_next_action: {
        Args: {
          d: Omit<
            Database["public"]["Tables"]["duels"]["Row"],
            Database["public"]["Tables"]["duels"]["ComputedFields"]
          >;
          uid: string;
        };
        Returns: string;
      };
      duel_result: {
        Args: {
          d: Omit<
            Database["public"]["Tables"]["duels"]["Row"],
            Database["public"]["Tables"]["duels"]["ComputedFields"]
          >;
          uid: string;
        };
        Returns: string;
      };
      expire_duels: { Args: { uid: string }; Returns: undefined };
      export_questions: { Args: Record<PropertyKey, never>; Returns: Json };
      file_question_report: {
        Args: { question: string; report_locale: string; report_reason: string; reporter: string };
        Returns: undefined;
      };
      get_duel: { Args: { duel_id: string }; Returns: Json };
      get_quick_match: { Args: { match_id: string }; Returns: Json };
      import_questions: { Args: { items: Json }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_playable: {
        Args: {
          q: Omit<
            Database["public"]["Tables"]["questions"]["Row"],
            Database["public"]["Tables"]["questions"]["ComputedFields"]
          >;
        };
        Returns: boolean;
      };
      is_username_allowed: { Args: { candidate: string }; Returns: boolean };
      is_username_available: { Args: { candidate: string }; Returns: boolean };
      list_duels: { Args: Record<PropertyKey, never>; Returns: Json };
      list_friends: { Args: Record<PropertyKey, never>; Returns: Json };
      lock_active_duel: {
        Args: { target: string; uid: string };
        Returns: {
          challenger_id: string;
          created_at: string;
          deadline_warned_turn: number | null;
          difficulty: string;
          end_reason: string | null;
          finished_at: string | null;
          id: string;
          opponent_id: string;
          round_count: number;
          status: string;
          turn_deadline: string;
          turn_number: number;
          winner_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "duels";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_untranslatable: {
        Args: { external_ids: string[]; target_locale: string };
        Returns: number;
      };
      notify: {
        Args: { actor: string; notification_kind: string; related_duel?: string; target: string };
        Returns: undefined;
      };
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
      remove_friend: { Args: { other: string }; Returns: undefined };
      report_duel_question: {
        Args: { duel_id: string; question_round: number; question_slot: number; reason: string };
        Returns: undefined;
      };
      report_quick_question: {
        Args: { match_id: string; question_position: number; reason: string };
        Returns: undefined;
      };
      require_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
      respond_friend_request: { Args: { accept: boolean; requester: string }; Returns: undefined };
      retention_stats: {
        Args: { days?: number };
        Returns: {
          d1: number;
          d1_pct: number;
          d7: number;
          d7_pct: number;
          signup_day: string;
          signups: number;
        }[];
      };
      review_questions: { Args: { items: Json }; Returns: number };
      save_push_subscription: {
        Args: { sub_auth: string; sub_endpoint: string; sub_p256dh: string };
        Returns: undefined;
      };
      search_players: { Args: { query: string }; Returns: Json };
      send_friend_request: { Args: { target: string }; Returns: string };
      serve_duel_question: { Args: { duel_id: string }; Returns: Json };
      serve_quick_question: { Args: { match_id: string }; Returns: Json };
      spin_duel_round: { Args: { duel_id: string }; Returns: Json };
      start_duel: {
        Args: { duel_difficulty: string; duel_round_count?: number; opponent: string };
        Returns: string;
      };
      start_quick_match: {
        Args: { guest_ids?: string[]; match_difficulty: string };
        Returns: string;
      };
      surrender_duel: { Args: { duel_id: string }; Returns: undefined };
      warn_duel_deadlines: { Args: Record<PropertyKey, never>; Returns: number };
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
