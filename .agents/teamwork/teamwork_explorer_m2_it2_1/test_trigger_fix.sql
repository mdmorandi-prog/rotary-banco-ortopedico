-- Drop old trigger and function
DROP TRIGGER IF EXISTS trg_loan_equipment_status_sync ON public.loans;
DROP FUNCTION IF EXISTS public.fn_sync_loan_equipment_status();

-- 1. Create BEFORE trigger function
CREATE OR REPLACE FUNCTION public.fn_loan_equipment_status_before()
RETURNS TRIGGER AS $$
DECLARE
  v_destination public.equipment_status;
  v_equipment_current_status public.equipment_status;
BEGIN
  -- Prevent infinite trigger recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- CASE 1: LOAN CREATION (INSERT)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ATIVO' THEN
      -- Check availability and acquire row lock on equipment
      SELECT status INTO v_equipment_current_status
      FROM public.equipments
      WHERE id = NEW.equipment_id
      FOR UPDATE;

      IF v_equipment_current_status IS NULL THEN
        RAISE EXCEPTION 'Equipamento % não encontrado.', NEW.equipment_id;
      END IF;

      IF v_equipment_current_status != 'DISPONIVEL' THEN
        RAISE EXCEPTION 'Equipamento % não está DISPONIVEL (status atual: %).', NEW.equipment_id, v_equipment_current_status;
      END IF;

      UPDATE public.equipments
      SET status = 'EMPRESTADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    ELSIF NEW.status = 'ATRASADO' THEN
      SELECT status INTO v_equipment_current_status
      FROM public.equipments
      WHERE id = NEW.equipment_id
      FOR UPDATE;

      IF v_equipment_current_status IS NULL THEN
        RAISE EXCEPTION 'Equipamento % não encontrado.', NEW.equipment_id;
      END IF;

      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;
    END IF;

    RETURN NEW;
  END IF;

  -- CASE 2: LOAN MODIFICATION (UPDATE)
  IF TG_OP = 'UPDATE' THEN
    -- Invariant: Equipment ID cannot be altered on an existing contract
    IF OLD.equipment_id != NEW.equipment_id THEN
      RAISE EXCEPTION 'Não é permitido alterar o equipamento de um contrato de comodato existente.';
    END IF;

    -- Subcase 2.1: Transition to DEVOLVIDO (Return Triage)
    IF OLD.status != 'DEVOLVIDO' AND NEW.status = 'DEVOLVIDO' THEN
      IF NEW.actual_return_date IS NULL THEN
        NEW.actual_return_date = now();
      END IF;

      -- Determine post-return destination with smart fallback
      v_destination := COALESCE(
        NEW.post_return_destination,
        CASE
          WHEN NEW.return_condition IN ('PRECISA_REPARO', 'SUCATEADO') THEN 'MANUTENCAO'::public.equipment_status
          ELSE 'HIGIENIZACAO'::public.equipment_status
        END
      );

      UPDATE public.equipments
      SET
        status = v_destination,
        condition = COALESCE(NEW.return_condition, condition),
        updated_at = now()
      WHERE id = NEW.equipment_id;

    -- Subcase 2.2: Transition to ATRASADO (Overdue via Cron or Manual)
    ELSIF OLD.status != 'ATRASADO' AND NEW.status = 'ATRASADO' THEN
      UPDATE public.equipments
      SET status = 'ATRASADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    -- Subcase 2.3: Transition from ATRASADO to ATIVO (Renewal or manual un-overdue)
    ELSIF OLD.status = 'ATRASADO' AND NEW.status = 'ATIVO' THEN
      UPDATE public.equipments
      SET status = 'EMPRESTADO', updated_at = now()
      WHERE id = NEW.equipment_id;

    -- Subcase 2.4: Transition to CANCELADO
    ELSIF OLD.status != 'CANCELADO' AND NEW.status = 'CANCELADO' THEN
      UPDATE public.equipments
      SET status = 'DISPONIVEL', updated_at = now()
      WHERE id = NEW.equipment_id;
    END IF;

    -- Subcase 2.5: Renewal count validation
    IF NEW.renewal_count > OLD.renewal_count THEN
      IF NEW.renewal_count > NEW.max_renewals THEN
        RAISE EXCEPTION 'Limite máximo de % renovações atingido para este contrato.', NEW.max_renewals;
      END IF;
    END IF;

    -- Subcase 2.6: Quittance issuance default timestamp
    IF NEW.quittance_issued = true AND (OLD.quittance_issued IS NULL OR OLD.quittance_issued = false) THEN
      IF NEW.quittance_issued_at IS NULL THEN
        NEW.quittance_issued_at = now();
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create AFTER trigger function
CREATE OR REPLACE FUNCTION public.fn_loan_events_log_after()
RETURNS TRIGGER AS $$
DECLARE
  v_destination public.equipment_status;
BEGIN
  -- Prevent infinite trigger recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- CASE 1: LOAN CREATION (INSERT)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ATIVO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NULL, NEW.status, 'Empréstimo iniciado e comodato formalizado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    ELSIF NEW.status = 'ATRASADO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'CREATED', NULL, NEW.status, 'Empréstimo importado/cadastrado com status atrasado.', NEW.created_by,
        jsonb_build_object('equipment_id', NEW.equipment_id, 'expected_return_date', NEW.expected_return_date)
      );
    END IF;

    RETURN NEW;
  END IF;

  -- CASE 2: LOAN MODIFICATION (UPDATE)
  IF TG_OP = 'UPDATE' THEN
    -- Subcase 2.1: Transition to DEVOLVIDO (Return Triage)
    IF OLD.status != 'DEVOLVIDO' AND NEW.status = 'DEVOLVIDO' THEN
      v_destination := COALESCE(
        NEW.post_return_destination,
        CASE
          WHEN NEW.return_condition IN ('PRECISA_REPARO', 'SUCATEADO') THEN 'MANUTENCAO'::public.equipment_status
          ELSE 'HIGIENIZACAO'::public.equipment_status
        END
      );

      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by, metadata
      ) VALUES (
        NEW.id, 'RETURNED', OLD.status, NEW.status,
        CONCAT('Devolução registrada. Equipamento direcionado para: ', v_destination::text),
        NEW.created_by,
        jsonb_build_object(
          'close_reason', NEW.close_reason,
          'return_condition', NEW.return_condition,
          'destination', v_destination,
          'actual_return_date', NEW.actual_return_date
        )
      );

    -- Subcase 2.2: Transition to ATRASADO (Overdue via Cron or Manual)
    ELSIF OLD.status != 'ATRASADO' AND NEW.status = 'ATRASADO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'OVERDUE', OLD.status, NEW.status,
        'Prazo de devolução expirado. Marcado como atrasado.',
        NEW.created_by
      );

    -- Subcase 2.3: Transition to CANCELADO
    ELSIF OLD.status != 'CANCELADO' AND NEW.status = 'CANCELADO' THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'CANCELLED', OLD.status, NEW.status,
        'Empréstimo cancelado. Equipamento liberado para estoque.',
        NEW.created_by
      );
    END IF;

    -- Subcase 2.4: Renewal event
    IF NEW.renewal_count > OLD.renewal_count THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, metadata
      ) VALUES (
        NEW.id, 'RENEWED', OLD.status, NEW.status,
        CONCAT('Empréstimo renovado (', NEW.renewal_count, '/', NEW.max_renewals, '). Novo prazo: ', NEW.expected_return_date::text),
        jsonb_build_object(
          'old_expected_date', OLD.expected_return_date,
          'new_expected_date', NEW.expected_return_date,
          'renewal_count', NEW.renewal_count,
          'max_renewals', NEW.max_renewals
        )
      );
    END IF;

    -- Subcase 2.5: Quittance issuance audit
    IF NEW.quittance_issued = true AND (OLD.quittance_issued IS NULL OR OLD.quittance_issued = false) THEN
      INSERT INTO public.loan_events_log (
        loan_id, event_type, old_status, new_status, notes, performed_by
      ) VALUES (
        NEW.id, 'QUITTANCE_ISSUED', OLD.status, NEW.status,
        'Termo de Quitação emitido formalmente.',
        NEW.created_by
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Attach BEFORE trigger
DROP TRIGGER IF EXISTS trg_loan_equipment_status_before ON public.loans;
CREATE TRIGGER trg_loan_equipment_status_before
  BEFORE INSERT OR UPDATE OF status, post_return_destination, return_condition, renewal_count, quittance_issued, equipment_id
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_loan_equipment_status_before();

-- 4. Attach AFTER trigger
DROP TRIGGER IF EXISTS trg_loan_events_log_after ON public.loans;
CREATE TRIGGER trg_loan_events_log_after
  AFTER INSERT OR UPDATE OF status, renewal_count, quittance_issued
  ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.fn_loan_events_log_after();
