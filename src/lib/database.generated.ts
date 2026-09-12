export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          reason: string
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          reason: string
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string
          target_id?: string | null
        }
        Relationships: []
      }
      admin_memberships: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          domain_key: string
          event_name: string
          id: string
          provenance: string
          session_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          domain_key: string
          event_name: string
          id?: string
          provenance: string
          session_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          domain_key?: string
          event_name?: string
          id?: string
          provenance?: string
          session_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      campaign_state: {
        Row: {
          active_version: string
          allocated_founders: number
          id: string
          paused: boolean
          updated_at: string
        }
        Insert: {
          active_version: string
          allocated_founders?: number
          id: string
          paused?: boolean
          updated_at?: string
        }
        Update: {
          active_version?: string
          allocated_founders?: number
          id?: string
          paused?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_state_active_version_fkey"
            columns: ["active_version"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_versions: {
        Row: {
          campaign_id: string
          created_at: string
          currency: string
          eligibility_region: string | null
          ends_at: string | null
          founder_cap: number
          id: string
          minimum_age: number
          privacy_body: string
          published_at: string | null
          referral_cap: number
          referral_minor: number
          starts_at: string | null
          terms_body: string
          welcome_minor: number
        }
        Insert: {
          campaign_id?: string
          created_at?: string
          currency?: string
          eligibility_region?: string | null
          ends_at?: string | null
          founder_cap: number
          id: string
          minimum_age?: number
          privacy_body: string
          published_at?: string | null
          referral_cap: number
          referral_minor: number
          starts_at?: string | null
          terms_body: string
          welcome_minor: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          currency?: string
          eligibility_region?: string | null
          ends_at?: string | null
          founder_cap?: number
          id?: string
          minimum_age?: number
          privacy_body?: string
          published_at?: string | null
          referral_cap?: number
          referral_minor?: number
          starts_at?: string | null
          terms_body?: string
          welcome_minor?: number
        }
        Relationships: []
      }
      credit_entries: {
        Row: {
          amount_minor: number
          beneficiary_id: string
          campaign_id: string
          created_at: string
          currency: string
          id: string
          reason: string | null
          referral_id: string | null
          reversal_of: string | null
          source_key: string
          source_type: string
          terms_version: string
        }
        Insert: {
          amount_minor: number
          beneficiary_id: string
          campaign_id?: string
          created_at?: string
          currency?: string
          id?: string
          reason?: string | null
          referral_id?: string | null
          reversal_of?: string | null
          source_key: string
          source_type: string
          terms_version: string
        }
        Update: {
          amount_minor?: number
          beneficiary_id?: string
          campaign_id?: string
          created_at?: string
          currency?: string
          id?: string
          reason?: string | null
          referral_id?: string | null
          reversal_of?: string | null
          source_key?: string
          source_type?: string
          terms_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_entries_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_entries_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "credit_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_entries_terms_version_fkey"
            columns: ["terms_version"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          operator_note: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          operator_note?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          operator_note?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          accepted_at: string
          campaign_id: string
          created_at: string
          eligibility: string
          founder_ordinal: number | null
          referral_slots_consumed: number
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at: string
          campaign_id?: string
          created_at?: string
          eligibility: string
          founder_ordinal?: number | null
          referral_slots_consumed?: number
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          campaign_id?: string
          created_at?: string
          eligibility?: string
          founder_ordinal?: number | null
          referral_slots_consumed?: number
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_terms_version_fkey"
            columns: ["terms_version"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      handle_registry: {
        Row: {
          attempt_id: string | null
          expires_at: string | null
          handle: string
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          expires_at?: string | null
          handle: string
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          expires_at?: string | null
          handle?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handle_registry_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "pending_signups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handle_registry_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          actor_key: string
          created_at: string
          key: string
          operation: string
          outcome: Json
          request_hash: string
        }
        Insert: {
          actor_key: string
          created_at?: string
          key: string
          operation: string
          outcome: Json
          request_hash: string
        }
        Update: {
          actor_key?: string
          created_at?: string
          key?: string
          operation?: string
          outcome?: Json
          request_hash?: string
        }
        Relationships: []
      }
      invitation_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      participant_tags: {
        Row: {
          cohort: Database["public"]["Enums"]["participant_cohort"]
          created_at: string
          email: string
          reason: string
          review_required: boolean
        }
        Insert: {
          cohort: Database["public"]["Enums"]["participant_cohort"]
          created_at?: string
          email: string
          reason: string
          review_required?: boolean
        }
        Update: {
          cohort?: Database["public"]["Enums"]["participant_cohort"]
          created_at?: string
          email?: string
          reason?: string
          review_required?: boolean
        }
        Relationships: []
      }
      pending_signups: {
        Row: {
          accepted_at: string
          campaign_tag: string | null
          cohort: Database["public"]["Enums"]["participant_cohort"]
          created_at: string
          eligible_attestation: boolean
          email: string
          expires_at: string
          finalized_at: string | null
          finalized_user_id: string | null
          handle: string
          id: string
          inviter_id: string | null
          offer_displayed: boolean
          otp_last_requested_at: string | null
          otp_provider_accepted_at: string | null
          review_required: boolean
          source: string
          terms_version: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string
          campaign_tag?: string | null
          cohort?: Database["public"]["Enums"]["participant_cohort"]
          created_at?: string
          eligible_attestation: boolean
          email: string
          expires_at?: string
          finalized_at?: string | null
          finalized_user_id?: string | null
          handle: string
          id?: string
          inviter_id?: string | null
          offer_displayed: boolean
          otp_last_requested_at?: string | null
          otp_provider_accepted_at?: string | null
          review_required?: boolean
          source: string
          terms_version: string
          token_hash: string
        }
        Update: {
          accepted_at?: string
          campaign_tag?: string | null
          cohort?: Database["public"]["Enums"]["participant_cohort"]
          created_at?: string
          eligible_attestation?: boolean
          email?: string
          expires_at?: string
          finalized_at?: string | null
          finalized_user_id?: string | null
          handle?: string
          id?: string
          inviter_id?: string | null
          offer_displayed?: boolean
          otp_last_requested_at?: string | null
          otp_provider_accepted_at?: string | null
          review_required?: boolean
          source?: string
          terms_version?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_signups_finalized_user_id_fkey"
            columns: ["finalized_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pending_signups_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pending_signups_terms_version_fkey"
            columns: ["terms_version"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          analytics_consent: boolean
          campaign_tag: string | null
          cohort: Database["public"]["Enums"]["participant_cohort"]
          completed_at: string
          consent_updated_at: string
          handle: string
          marketing_consent: boolean
          review_required: boolean
          source: string
          user_id: string
          verified_at: string
        }
        Insert: {
          analytics_consent?: boolean
          campaign_tag?: string | null
          cohort?: Database["public"]["Enums"]["participant_cohort"]
          completed_at?: string
          consent_updated_at?: string
          handle: string
          marketing_consent?: boolean
          review_required?: boolean
          source: string
          user_id: string
          verified_at: string
        }
        Update: {
          analytics_consent?: boolean
          campaign_tag?: string | null
          cohort?: Database["public"]["Enums"]["participant_cohort"]
          completed_at?: string
          consent_updated_at?: string
          handle?: string
          marketing_consent?: boolean
          review_required?: boolean
          source?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      qualification_answers: {
        Row: {
          pilot_interest: boolean
          recent_use_case: string | null
          upcoming_need: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          pilot_interest?: boolean
          recent_use_case?: string | null
          upcoming_need?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          pilot_interest?: boolean
          recent_use_case?: string | null
          upcoming_need?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualification_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credited_at: string | null
          id: string
          invitee_id: string
          inviter_id: string
          qualified_at: string | null
          reason_code: string | null
          reward_slot: number | null
          status: Database["public"]["Enums"]["referral_status"]
          terms_version: string
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          id?: string
          invitee_id: string
          inviter_id: string
          qualified_at?: string | null
          reason_code?: string | null
          reward_slot?: number | null
          status?: Database["public"]["Enums"]["referral_status"]
          terms_version: string
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          id?: string
          invitee_id?: string
          inviter_id?: string
          qualified_at?: string | null
          reason_code?: string | null
          reward_slot?: number | null
          status?: Database["public"]["Enums"]["referral_status"]
          terms_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_terms_version_fkey"
            columns: ["terms_version"]
            isOneToOne: false
            referencedRelation: "campaign_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      neylo_account: { Args: { p_user_id: string }; Returns: Json }
      neylo_campaign: { Args: never; Returns: Json }
      neylo_classify: {
        Args: {
          p_actor: string
          p_cohort: Database["public"]["Enums"]["participant_cohort"]
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      neylo_client_event: {
        Args: {
          p_key: string
          p_name: string
          p_session_hash: string
          p_user_id: string
        }
        Returns: undefined
      }
      neylo_finalize: {
        Args: {
          p_idempotency_key: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: Json
      }
      neylo_handle_available: { Args: { p_handle: string }; Returns: boolean }
      neylo_hold: {
        Args: {
          p_campaign_tag: string
          p_email: string
          p_handle: string
          p_invitation: string
          p_offer_displayed: boolean
          p_source: string
          p_terms_version: string
          p_token_hash: string
        }
        Returns: Json
      }
      neylo_invitation: { Args: { p_code: string }; Returns: Json }
      neylo_metrics: {
        Args: {
          p_actor: string
          p_cohort?: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      neylo_otp_accepted: { Args: { p_token_hash: string }; Returns: undefined }
      neylo_pause: {
        Args: { p_actor: string; p_paused: boolean; p_reason: string }
        Returns: undefined
      }
      neylo_pending: { Args: { p_token_hash: string }; Returns: Json }
      neylo_preferences: {
        Args: { p_analytics: boolean; p_marketing: boolean; p_user_id: string }
        Returns: undefined
      }
      neylo_process_deletion: {
        Args: {
          p_actor: string
          p_note: string
          p_status: string
          p_user_id: string
        }
        Returns: undefined
      }
      neylo_qualification: {
        Args: {
          p_need: string
          p_pilot: boolean
          p_use_case: string
          p_user_id: string
        }
        Returns: undefined
      }
      neylo_qualify_referral: {
        Args: { p_referral_id: string }
        Returns: undefined
      }
      neylo_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      neylo_reconcile: { Args: { p_actor: string }; Returns: Json }
      neylo_request_deletion: { Args: { p_user_id: string }; Returns: string }
      neylo_request_otp: { Args: { p_token_hash: string }; Returns: boolean }
      neylo_require_admin: {
        Args: { p_actor: string; p_operator?: boolean }
        Returns: string
      }
      neylo_reverse: {
        Args: { p_actor: string; p_entry_id: string; p_reason: string }
        Returns: string
      }
      neylo_review: {
        Args: {
          p_actor: string
          p_decision: string
          p_reason: string
          p_user_id: string
        }
        Returns: undefined
      }
      neylo_review_queue: { Args: { p_actor: string }; Returns: Json }
      neylo_valid_handle: { Args: { p_handle: string }; Returns: boolean }
    }
    Enums: {
      participant_cohort:
        | "independent"
        | "founder_assisted"
        | "staff"
        | "test"
        | "compensated"
      referral_status:
        | "pending"
        | "qualified"
        | "review_required"
        | "credited"
        | "ineligible"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      participant_cohort: [
        "independent",
        "founder_assisted",
        "staff",
        "test",
        "compensated",
      ],
      referral_status: [
        "pending",
        "qualified",
        "review_required",
        "credited",
        "ineligible",
      ],
    },
  },
} as const

