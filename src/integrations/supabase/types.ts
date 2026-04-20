export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_data: Json | null
          action_type: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          action_data?: Json | null
          action_type: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_data?: Json | null
          action_type?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      centralized_game_progress: {
        Row: {
          buyers: Json | null
          completed_orders: number | null
          completed_sales_in_cycle: number | null
          created_at: string | null
          current_trips: Json | null
          current_warehouse: string | null
          day: number | null
          drivers: Json | null
          enterprises: Json | null
          game_time: Json | null
          id: string
          last_buyer_generation: number | null
          last_interest_calculation: number | null
          last_price_update: number | null
          last_weekly_cost_paid: number | null
          lawyer_hired: boolean | null
          money: number | null
          motorcycles: Json | null
          nova_aba: Json | null
          overdraft_limit: number | null
          pending_deliveries: Json | null
          police_interceptions: Json | null
          product_sales: Json | null
          stock: Json | null
          tow_truck_hired: boolean | null
          updated_at: string | null
          user_id: string
          vehicle_sales: Json | null
          vehicles: Json | null
          warehouse_capacity: number | null
          warehouse_level: number | null
        }
        Insert: {
          buyers?: Json | null
          completed_orders?: number | null
          completed_sales_in_cycle?: number | null
          created_at?: string | null
          current_trips?: Json | null
          current_warehouse?: string | null
          day?: number | null
          drivers?: Json | null
          enterprises?: Json | null
          game_time?: Json | null
          id?: string
          last_buyer_generation?: number | null
          last_interest_calculation?: number | null
          last_price_update?: number | null
          last_weekly_cost_paid?: number | null
          lawyer_hired?: boolean | null
          money?: number | null
          motorcycles?: Json | null
          nova_aba?: Json | null
          overdraft_limit?: number | null
          pending_deliveries?: Json | null
          police_interceptions?: Json | null
          product_sales?: Json | null
          stock?: Json | null
          tow_truck_hired?: boolean | null
          updated_at?: string | null
          user_id: string
          vehicle_sales?: Json | null
          vehicles?: Json | null
          warehouse_capacity?: number | null
          warehouse_level?: number | null
        }
        Update: {
          buyers?: Json | null
          completed_orders?: number | null
          completed_sales_in_cycle?: number | null
          created_at?: string | null
          current_trips?: Json | null
          current_warehouse?: string | null
          day?: number | null
          drivers?: Json | null
          enterprises?: Json | null
          game_time?: Json | null
          id?: string
          last_buyer_generation?: number | null
          last_interest_calculation?: number | null
          last_price_update?: number | null
          last_weekly_cost_paid?: number | null
          lawyer_hired?: boolean | null
          money?: number | null
          motorcycles?: Json | null
          nova_aba?: Json | null
          overdraft_limit?: number | null
          pending_deliveries?: Json | null
          police_interceptions?: Json | null
          product_sales?: Json | null
          stock?: Json | null
          tow_truck_hired?: boolean | null
          updated_at?: string | null
          user_id?: string
          vehicle_sales?: Json | null
          vehicles?: Json | null
          warehouse_capacity?: number | null
          warehouse_level?: number | null
        }
        Relationships: []
      }
      game_backups: {
        Row: {
          backup_data: Json
          backup_type: string | null
          created_at: string | null
          game_day: number | null
          id: string
          total_money: number | null
          user_id: string | null
        }
        Insert: {
          backup_data: Json
          backup_type?: string | null
          created_at?: string | null
          game_day?: number | null
          id?: string
          total_money?: number | null
          user_id?: string | null
        }
        Update: {
          backup_data?: Json
          backup_type?: string | null
          created_at?: string | null
          game_day?: number | null
          id?: string
          total_money?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      game_progress: {
        Row: {
          buyers: Json | null
          completed_orders: number | null
          completed_sales_in_cycle: number | null
          created_at: string | null
          current_trips: Json | null
          current_warehouse: string | null
          drivers: Json | null
          game_day: number | null
          game_hour: number | null
          game_minute: number | null
          id: string
          is_waiting_for_new_buyers: boolean | null
          last_backup: string | null
          last_buyer_generation: number | null
          last_game_update: number | null
          last_interest_calculation: number | null
          last_price_update: number | null
          last_weekly_cost_paid: number | null
          lawyer_hired: boolean | null
          money: number
          new_buyers_timer_duration: number | null
          new_buyers_timer_start: number | null
          overdraft_limit: number | null
          pending_deliveries: Json | null
          police_interceptions: Json | null
          product_sales: Json | null
          stock: Json | null
          stores: Json | null
          tow_truck_hired: boolean | null
          updated_at: string | null
          user_id: string | null
          vehicle_sales: Json | null
          vehicles: Json | null
          warehouse_capacity: number | null
          warehouse_level: number | null
        }
        Insert: {
          buyers?: Json | null
          completed_orders?: number | null
          completed_sales_in_cycle?: number | null
          created_at?: string | null
          current_trips?: Json | null
          current_warehouse?: string | null
          drivers?: Json | null
          game_day?: number | null
          game_hour?: number | null
          game_minute?: number | null
          id?: string
          is_waiting_for_new_buyers?: boolean | null
          last_backup?: string | null
          last_buyer_generation?: number | null
          last_game_update?: number | null
          last_interest_calculation?: number | null
          last_price_update?: number | null
          last_weekly_cost_paid?: number | null
          lawyer_hired?: boolean | null
          money?: number
          new_buyers_timer_duration?: number | null
          new_buyers_timer_start?: number | null
          overdraft_limit?: number | null
          pending_deliveries?: Json | null
          police_interceptions?: Json | null
          product_sales?: Json | null
          stock?: Json | null
          stores?: Json | null
          tow_truck_hired?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_sales?: Json | null
          vehicles?: Json | null
          warehouse_capacity?: number | null
          warehouse_level?: number | null
        }
        Update: {
          buyers?: Json | null
          completed_orders?: number | null
          completed_sales_in_cycle?: number | null
          created_at?: string | null
          current_trips?: Json | null
          current_warehouse?: string | null
          drivers?: Json | null
          game_day?: number | null
          game_hour?: number | null
          game_minute?: number | null
          id?: string
          is_waiting_for_new_buyers?: boolean | null
          last_backup?: string | null
          last_buyer_generation?: number | null
          last_game_update?: number | null
          last_interest_calculation?: number | null
          last_price_update?: number | null
          last_weekly_cost_paid?: number | null
          lawyer_hired?: boolean | null
          money?: number
          new_buyers_timer_duration?: number | null
          new_buyers_timer_start?: number | null
          overdraft_limit?: number | null
          pending_deliveries?: Json | null
          police_interceptions?: Json | null
          product_sales?: Json | null
          stock?: Json | null
          stores?: Json | null
          tow_truck_hired?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_sales?: Json | null
          vehicles?: Json | null
          warehouse_capacity?: number | null
          warehouse_level?: number | null
        }
        Relationships: []
      }
      player_profiles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          level: number | null
          total_assets_value: number | null
          total_patrimony: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          level?: number | null
          total_assets_value?: number | null
          total_patrimony?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          level?: number | null
          total_assets_value?: number | null
          total_patrimony?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      player_ranking: {
        Row: {
          created_at: string | null
          display_name: string
          game_day: number | null
          id: string
          last_updated: string | null
          level: number | null
          money: number | null
          stores_owned: Json | null
          total_patrimony: number
          total_stores: number | null
          total_vehicles: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          game_day?: number | null
          id?: string
          last_updated?: string | null
          level?: number | null
          money?: number | null
          stores_owned?: Json | null
          total_patrimony?: number
          total_stores?: number | null
          total_vehicles?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          game_day?: number | null
          id?: string
          last_updated?: string | null
          level?: number | null
          money?: number | null
          stores_owned?: Json | null
          total_patrimony?: number
          total_stores?: number | null
          total_vehicles?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      simple_game_progress: {
        Row: {
          created_at: string | null
          game_data: Json
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          game_data: Json
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          game_data?: Json
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      top_players: {
        Row: {
          display_name: string | null
          game_day: number | null
          last_updated: string | null
          stores_owned: Json | null
          total_patrimony: number | null
          total_stores: number | null
          total_vehicles: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      backup_user_game_progress: {
        Args: { user_uuid: string }
        Returns: Json
      }
      calculate_total_patrimony: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_total_patrimony_complete: {
        Args: { p_user_id: string }
        Returns: number
      }
      cleanup_orphaned_records: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_game_backup: {
        Args: { p_backup_type?: string; p_user_id: string }
        Returns: string
      }
      get_initial_centralized_game_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_initial_game_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_initial_game_data_with_enterprises: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      handle_user_deletion: {
        Args: { deleted_user_id: string }
        Returns: undefined
      }
      migrate_from_simple_game_progress: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      migrate_simple_to_comprehensive_game_progress: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      normalize_game_data_with_enterprises: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_player_ranking: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_player_ranking_complete: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      upsert_centralized_game_progress: {
        Args: { p_data: Json; p_user_id: string }
        Returns: undefined
      }
      upsert_game_progress_safe: {
        Args: {
          p_buyers: Json
          p_completed_orders: number
          p_completed_sales_in_cycle: number
          p_current_trips: Json
          p_current_warehouse: string
          p_drivers: Json
          p_game_day: number
          p_game_hour: number
          p_game_minute: number
          p_is_waiting_for_new_buyers: boolean
          p_last_buyer_generation: number
          p_last_game_update: number
          p_last_interest_calculation: number
          p_last_price_update: number
          p_last_weekly_cost_paid: number
          p_lawyer_hired: boolean
          p_money: number
          p_new_buyers_timer_duration: number
          p_new_buyers_timer_start: number
          p_overdraft_limit: number
          p_pending_deliveries: Json
          p_police_interceptions: Json
          p_product_sales: Json
          p_stock: Json
          p_stores: Json
          p_tow_truck_hired: boolean
          p_user_id: string
          p_vehicle_sales: Json
          p_vehicles: Json
          p_warehouse_capacity: number
          p_warehouse_level: number
        }
        Returns: boolean
      }
      validate_game_progress_data: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      verify_centralized_game_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_money: number
          total_users: number
          users_with_enterprises: number
          users_with_stock: number
          users_with_vehicles: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
