-- ShardCFO Seed Data
-- This seed data creates demo companies with realistic financial data.
-- It should be run AFTER a user has signed up and their profile exists.
-- Replace the UUID below with the actual user's profile ID after signup.

-- NOTE: This seed data is designed to be run via Supabase SQL editor
-- after a real user has signed up. The owner_id references must match
-- an existing profile.

-- For demo purposes, we'll use a function that inserts data for a given user.

CREATE OR REPLACE FUNCTION seed_demo_data(p_owner_id UUID)
RETURNS void AS $$
DECLARE
  v_company1_id UUID;
  v_company2_id UUID;
  v_period_id UUID;
  v_base_date DATE;
  v_month_offset INTEGER;
  -- Account IDs for TechFlow
  v_rev_sub UUID;
  v_rev_services UUID;
  v_cogs_hosting UUID;
  v_cogs_support UUID;
  v_opex_payroll UUID;
  v_opex_marketing UUID;
  v_opex_tools UUID;
  v_opex_office UUID;
  v_opex_legal UUID;
  v_opex_other UUID;
  v_other_income UUID;
  v_other_expense UUID;
  -- Account IDs for GreenLeaf
  v_gl_rev_sub UUID;
  v_gl_cogs UUID;
  v_gl_opex_payroll UUID;
  v_gl_opex_marketing UUID;
  v_gl_opex_tools UUID;
  v_gl_opex_other UUID;
BEGIN
  -- ==========================================
  -- COMPANY 1: TechFlow SaaS (Series A)
  -- ==========================================
  INSERT INTO public.companies (id, owner_id, name, legal_entity, industry, stage, fiscal_year_end_month, currency, status)
  VALUES (gen_random_uuid(), p_owner_id, 'TechFlow SaaS', 'TechFlow Inc.', 'SaaS / B2B Software', 'series_a', 12, 'USD', 'active')
  RETURNING id INTO v_company1_id;

  -- Chart of Accounts for TechFlow
  INSERT INTO public.accounts (id, company_id, account_number, name, category, subcategory, display_order)
  VALUES
    (gen_random_uuid(), v_company1_id, '4000', 'Subscription Revenue', 'revenue', 'subscription', 1),
    (gen_random_uuid(), v_company1_id, '4100', 'Professional Services', 'revenue', 'services', 2),
    (gen_random_uuid(), v_company1_id, '5000', 'Cloud Hosting & Infrastructure', 'cogs', 'hosting', 3),
    (gen_random_uuid(), v_company1_id, '5100', 'Customer Support', 'cogs', 'support', 4),
    (gen_random_uuid(), v_company1_id, '6000', 'Salaries & Benefits', 'operating_expense', 'payroll', 5),
    (gen_random_uuid(), v_company1_id, '6100', 'Marketing & Advertising', 'operating_expense', 'marketing', 6),
    (gen_random_uuid(), v_company1_id, '6200', 'Software & Tools', 'operating_expense', 'saas_tools', 7),
    (gen_random_uuid(), v_company1_id, '6300', 'Office & Facilities', 'operating_expense', 'office', 8),
    (gen_random_uuid(), v_company1_id, '6400', 'Legal & Compliance', 'operating_expense', 'legal', 9),
    (gen_random_uuid(), v_company1_id, '6500', 'Other Operating Expenses', 'operating_expense', 'other', 10),
    (gen_random_uuid(), v_company1_id, '7000', 'Interest Income', 'other_income', 'interest', 11),
    (gen_random_uuid(), v_company1_id, '8000', 'Interest Expense', 'other_expense', 'interest', 12);

  -- Get account IDs
  SELECT id INTO v_rev_sub FROM public.accounts WHERE company_id = v_company1_id AND account_number = '4000';
  SELECT id INTO v_rev_services FROM public.accounts WHERE company_id = v_company1_id AND account_number = '4100';
  SELECT id INTO v_cogs_hosting FROM public.accounts WHERE company_id = v_company1_id AND account_number = '5000';
  SELECT id INTO v_cogs_support FROM public.accounts WHERE company_id = v_company1_id AND account_number = '5100';
  SELECT id INTO v_opex_payroll FROM public.accounts WHERE company_id = v_company1_id AND account_number = '6000';
  SELECT id INTO v_opex_marketing FROM public.accounts WHERE company_id = v_company1_id AND account_number = '6100';
  SELECT id INTO v_opex_tools FROM public.accounts WHERE company_id = v_company1_id AND account_number = '6200';
  SELECT id INTO v_opex_office FROM public.accounts WHERE company_id = v_company1_id AND account_number = '6300';
  SELECT id INTO v_opex_legal FROM public.accounts WHERE company_id = v_company1_id AND account_number = '6400';
  SELECT id INTO v_opex_other FROM public.accounts WHERE company_id = v_company1_id AND account_number = '6500';
  SELECT id INTO v_other_income FROM public.accounts WHERE company_id = v_company1_id AND account_number = '7000';
  SELECT id INTO v_other_expense FROM public.accounts WHERE company_id = v_company1_id AND account_number = '8000';

  -- Insert 12 months of financial data (actuals)
  -- TechFlow: Growing SaaS, Series A stage
  -- MRR: $85K → $140K over 12 months (~4.2% MoM growth)
  v_base_date := date_trunc('month', CURRENT_DATE) - INTERVAL '11 months';

  FOR v_month_offset IN 0..11 LOOP
    -- Create financial period
    INSERT INTO public.financial_periods (id, company_id, period_date, period_type, status)
    VALUES (gen_random_uuid(), v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'actual',
      CASE WHEN v_month_offset < 10 THEN 'approved' ELSE 'draft' END)
    RETURNING id INTO v_period_id;

    -- Insert line items with realistic growth trajectory
    INSERT INTO public.line_items (period_id, account_id, amount) VALUES
      -- Subscription Revenue: $85K base, ~4.2% MoM compound growth
      (v_period_id, v_rev_sub, ROUND(85000 * POWER(1.042, v_month_offset) + (random() * 3000 - 1500), 2)),
      -- Professional Services: ~$8K-$15K/month, growing slowly
      (v_period_id, v_rev_services, ROUND(8000 + v_month_offset * 600 + (random() * 2000), 2)),
      -- COGS - Hosting: ~18% of subscription revenue
      (v_period_id, v_cogs_hosting, ROUND(85000 * POWER(1.042, v_month_offset) * 0.18, 2)),
      -- COGS - Support: ~5% of total revenue
      (v_period_id, v_cogs_support, ROUND((85000 * POWER(1.042, v_month_offset) + 8000 + v_month_offset * 600) * 0.05, 2)),
      -- Payroll: $180K base, growing with hires
      (v_period_id, v_opex_payroll, ROUND(180000 + v_month_offset * 5000 + (random() * 2000), 2)),
      -- Marketing: $25K base, ramping up
      (v_period_id, v_opex_marketing, ROUND(25000 + v_month_offset * 1500 + (random() * 3000), 2)),
      -- Software/Tools: ~$8K/month
      (v_period_id, v_opex_tools, ROUND(8000 + (random() * 1000), 2)),
      -- Office: ~$12K/month
      (v_period_id, v_opex_office, ROUND(12000 + (random() * 500), 2)),
      -- Legal: ~$3K/month with occasional spikes
      (v_period_id, v_opex_legal, ROUND(3000 + (CASE WHEN v_month_offset % 4 = 0 THEN 5000 ELSE 0 END) + (random() * 1000), 2)),
      -- Other: ~$5K/month
      (v_period_id, v_opex_other, ROUND(5000 + (random() * 2000), 2)),
      -- Interest Income: ~$500/month
      (v_period_id, v_other_income, ROUND(500 + (random() * 200), 2)),
      -- Interest Expense: ~$200/month
      (v_period_id, v_other_expense, ROUND(200 + (random() * 100), 2));

    -- Insert budget periods (for current year months)
    IF EXTRACT(YEAR FROM v_base_date + (v_month_offset || ' months')::INTERVAL) = EXTRACT(YEAR FROM CURRENT_DATE) THEN
      INSERT INTO public.financial_periods (id, company_id, period_date, period_type, status)
      VALUES (gen_random_uuid(), v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'budget', 'approved')
      RETURNING id INTO v_period_id;

      INSERT INTO public.line_items (period_id, account_id, amount) VALUES
        (v_period_id, v_rev_sub, ROUND(90000 * POWER(1.05, v_month_offset), 2)),
        (v_period_id, v_rev_services, ROUND(10000 + v_month_offset * 500, 2)),
        (v_period_id, v_cogs_hosting, ROUND(90000 * POWER(1.05, v_month_offset) * 0.17, 2)),
        (v_period_id, v_cogs_support, ROUND((90000 * POWER(1.05, v_month_offset)) * 0.05, 2)),
        (v_period_id, v_opex_payroll, ROUND(175000 + v_month_offset * 6000, 2)),
        (v_period_id, v_opex_marketing, ROUND(28000 + v_month_offset * 2000, 2)),
        (v_period_id, v_opex_tools, 8500),
        (v_period_id, v_opex_office, 12000),
        (v_period_id, v_opex_legal, 4000),
        (v_period_id, v_opex_other, 5500),
        (v_period_id, v_other_income, 500),
        (v_period_id, v_other_expense, 200);
    END IF;

    -- Insert SaaS metrics
    INSERT INTO public.metrics (company_id, period_date, metric_key, metric_value, metric_unit, source) VALUES
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'mrr', ROUND(85000 * POWER(1.042, v_month_offset)), 'USD', 'manual'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'arr', ROUND(85000 * POWER(1.042, v_month_offset) * 12), 'USD', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'customers', ROUND(120 + v_month_offset * 8 + (random() * 3)), 'count', 'manual'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'churn_rate', ROUND(0.02 + (random() * 0.01), 4), '%', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'ndr', ROUND(1.06 + (random() * 0.04), 4), '%', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'burn_rate', ROUND(150000 - v_month_offset * 3000 + (random() * 5000)), 'USD', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'runway_months', ROUND(18 + v_month_offset * 0.5 + (random() * 2)), 'months', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'headcount', 22 + v_month_offset, 'count', 'manual'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'cac', ROUND(1200 - v_month_offset * 30 + (random() * 100)), 'USD', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'ltv', ROUND(15000 + v_month_offset * 500 + (random() * 1000)), 'USD', 'calculated'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'cash_balance', ROUND(3200000 - v_month_offset * 120000 + (random() * 50000)), 'USD', 'manual'),
      (v_company1_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'gross_margin', ROUND(0.74 + (random() * 0.04), 4), '%', 'calculated');
  END LOOP;

  -- Create a sample board deck for TechFlow
  INSERT INTO public.board_decks (company_id, title, period_start, period_end, status, template_key, sections)
  VALUES (
    v_company1_id,
    'Q4 2025 Board Deck',
    (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::DATE,
    (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::DATE,
    'draft',
    'standard',
    '[
      {"id": "1", "type": "title_slide", "config": {}, "order": 0},
      {"id": "2", "type": "key_highlights", "config": {"highlights": ["MRR grew 15% QoQ to $130K", "Net Dollar Retention at 108%", "Runway extended to 20 months after cost optimization", "3 enterprise deals in pipeline worth $500K ARR"]}, "order": 1},
      {"id": "3", "type": "financial_summary", "config": {}, "order": 2},
      {"id": "4", "type": "revenue_breakdown", "config": {}, "order": 3},
      {"id": "5", "type": "saas_metrics", "config": {}, "order": 4},
      {"id": "6", "type": "cash_runway", "config": {}, "order": 5},
      {"id": "7", "type": "budget_variance", "config": {}, "order": 6},
      {"id": "8", "type": "asks_and_decisions", "config": {"items": ["Approve $50K increase in marketing budget for Q1", "Decision on Series B timeline: Q2 vs Q3 2026", "Approve hiring plan: 3 engineers, 1 AE"]}, "order": 7}
    ]'::JSONB
  );

  -- Create a sample scenario
  INSERT INTO public.scenarios (company_id, name, description, base_period_date, assumptions)
  VALUES (
    v_company1_id,
    'Aggressive Growth Scenario',
    'What if we increase marketing spend by 50% and hire 5 more engineers?',
    date_trunc('month', CURRENT_DATE)::DATE,
    '{
      "mrr_growth_rate": 0.06,
      "new_hires_engineering": 5,
      "avg_salary_engineering": 155000,
      "marketing_budget_increase": 0.5,
      "cogs_percentage": 0.22,
      "months_to_project": 18
    }'::JSONB
  );

  -- ==========================================
  -- COMPANY 2: GreenLeaf Analytics (Seed)
  -- ==========================================
  INSERT INTO public.companies (id, owner_id, name, legal_entity, industry, stage, fiscal_year_end_month, currency, status)
  VALUES (gen_random_uuid(), p_owner_id, 'GreenLeaf Analytics', 'GreenLeaf Analytics LLC', 'Data / Analytics', 'seed', 12, 'USD', 'active')
  RETURNING id INTO v_company2_id;

  -- Chart of Accounts for GreenLeaf (simpler)
  INSERT INTO public.accounts (id, company_id, account_number, name, category, subcategory, display_order)
  VALUES
    (gen_random_uuid(), v_company2_id, '4000', 'Subscription Revenue', 'revenue', 'subscription', 1),
    (gen_random_uuid(), v_company2_id, '5000', 'Cloud & Infrastructure', 'cogs', 'hosting', 2),
    (gen_random_uuid(), v_company2_id, '6000', 'Salaries & Benefits', 'operating_expense', 'payroll', 3),
    (gen_random_uuid(), v_company2_id, '6100', 'Marketing', 'operating_expense', 'marketing', 4),
    (gen_random_uuid(), v_company2_id, '6200', 'Software & Tools', 'operating_expense', 'saas_tools', 5),
    (gen_random_uuid(), v_company2_id, '6500', 'Other Expenses', 'operating_expense', 'other', 6);

  SELECT id INTO v_gl_rev_sub FROM public.accounts WHERE company_id = v_company2_id AND account_number = '4000';
  SELECT id INTO v_gl_cogs FROM public.accounts WHERE company_id = v_company2_id AND account_number = '5000';
  SELECT id INTO v_gl_opex_payroll FROM public.accounts WHERE company_id = v_company2_id AND account_number = '6000';
  SELECT id INTO v_gl_opex_marketing FROM public.accounts WHERE company_id = v_company2_id AND account_number = '6100';
  SELECT id INTO v_gl_opex_tools FROM public.accounts WHERE company_id = v_company2_id AND account_number = '6200';
  SELECT id INTO v_gl_opex_other FROM public.accounts WHERE company_id = v_company2_id AND account_number = '6500';

  -- 8 months of data for GreenLeaf (earlier stage)
  v_base_date := date_trunc('month', CURRENT_DATE) - INTERVAL '7 months';

  FOR v_month_offset IN 0..7 LOOP
    INSERT INTO public.financial_periods (id, company_id, period_date, period_type, status)
    VALUES (gen_random_uuid(), v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'actual',
      CASE WHEN v_month_offset < 6 THEN 'approved' ELSE 'draft' END)
    RETURNING id INTO v_period_id;

    INSERT INTO public.line_items (period_id, account_id, amount) VALUES
      (v_period_id, v_gl_rev_sub, ROUND(12000 * POWER(1.11, v_month_offset) + (random() * 1500), 2)),
      (v_period_id, v_gl_cogs, ROUND(12000 * POWER(1.11, v_month_offset) * 0.25, 2)),
      (v_period_id, v_gl_opex_payroll, ROUND(65000 + v_month_offset * 3000 + (random() * 1000), 2)),
      (v_period_id, v_gl_opex_marketing, ROUND(8000 + v_month_offset * 500 + (random() * 1000), 2)),
      (v_period_id, v_gl_opex_tools, ROUND(3000 + (random() * 500), 2)),
      (v_period_id, v_gl_opex_other, ROUND(4000 + (random() * 1000), 2));

    INSERT INTO public.metrics (company_id, period_date, metric_key, metric_value, metric_unit, source) VALUES
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'mrr', ROUND(12000 * POWER(1.11, v_month_offset)), 'USD', 'manual'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'arr', ROUND(12000 * POWER(1.11, v_month_offset) * 12), 'USD', 'calculated'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'customers', ROUND(35 + v_month_offset * 4 + (random() * 2)), 'count', 'manual'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'churn_rate', ROUND(0.035 + (random() * 0.015), 4), '%', 'calculated'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'ndr', ROUND(1.02 + (random() * 0.03), 4), '%', 'calculated'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'burn_rate', ROUND(68000 - v_month_offset * 1000 + (random() * 3000)), 'USD', 'calculated'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'runway_months', ROUND(10 + (random() * 3)), 'months', 'calculated'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'headcount', 8 + FLOOR(v_month_offset / 2), 'count', 'manual'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'cash_balance', ROUND(750000 - v_month_offset * 55000 + (random() * 20000)), 'USD', 'manual'),
      (v_company2_id, v_base_date + (v_month_offset || ' months')::INTERVAL, 'gross_margin', ROUND(0.72 + (random() * 0.05), 4), '%', 'calculated');
  END LOOP;

  -- Audit log entries
  INSERT INTO public.audit_log (user_id, company_id, action, entity_type, entity_id, details) VALUES
    (p_owner_id, v_company1_id, 'company_created', 'company', v_company1_id, '{"source": "seed_data"}'::JSONB),
    (p_owner_id, v_company2_id, 'company_created', 'company', v_company2_id, '{"source": "seed_data"}'::JSONB),
    (p_owner_id, v_company1_id, 'data_imported', 'financial_periods', NULL, '{"months": 12, "source": "seed_data"}'::JSONB),
    (p_owner_id, v_company2_id, 'data_imported', 'financial_periods', NULL, '{"months": 8, "source": "seed_data"}'::JSONB);

END;
$$ LANGUAGE plpgsql;

-- To run this seed data after signing up, execute:
-- SELECT seed_demo_data('YOUR-USER-UUID-HERE');
