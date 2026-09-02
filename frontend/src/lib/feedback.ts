import { useRef } from 'react';
import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export interface FeedbackMessages<TData = unknown> {
  loading: string;
  success?: string | ((data: TData) => string);
  error?: string | ((error: any) => string);
}

function resolveMessage<T>(msg: string | ((arg: T) => string) | undefined, arg: T, fallback: string): string {
  if (!msg) return fallback;
  return typeof msg === 'function' ? (msg as (arg: T) => string)(arg) : msg;
}

function resolveErrorMessage(error: any, custom: FeedbackMessages['error']): string {
  if (custom) return resolveMessage(custom, error, '');
  return error?.response?.data?.error || error?.message || 'Ocorreu um erro. Tente novamente.';
}

/**
 * Wrapper sobre useMutation que mostra um único toast (react-hot-toast)
 * evoluindo de "Processando..." para sucesso/erro, atualizado pelo mesmo id.
 * Preserva onMutate/onSuccess/onError já passados em `options`.
 */
export function useFeedbackMutation<TData = unknown, TVariables = void, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  messages: FeedbackMessages<TData>,
  options: Omit<UseMutationOptions<TData, any, TVariables, TContext>, 'mutationFn'> = {}
): UseMutationResult<TData, any, TVariables, TContext> {
  const toastIdRef = useRef(`feedback-${Math.random().toString(36).slice(2)}`);

  const userOnMutate = options.onMutate as ((variables: TVariables) => any) | undefined;
  const userOnSuccess = options.onSuccess as ((data: TData, variables: TVariables, context: TContext) => any) | undefined;
  const userOnError = options.onError as ((error: any, variables: TVariables, context: TContext | undefined) => any) | undefined;

  return useMutation<TData, any, TVariables, TContext>({
    ...options,
    mutationFn,
    onMutate: async (variables) => {
      toast.loading(messages.loading, { id: toastIdRef.current });
      return userOnMutate ? await userOnMutate(variables) : (undefined as unknown as TContext);
    },
    onSuccess: (data, variables, context) => {
      toast.success(resolveMessage(messages.success, data, 'Concluído!'), { id: toastIdRef.current });
      userOnSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      toast.error(resolveErrorMessage(error, messages.error), { id: toastIdRef.current });
      userOnError?.(error, variables, context);
    },
  });
}

/**
 * Mesma ideia para ações que não passam por useMutation (downloads,
 * login/register): mostra "Processando...", atualiza para sucesso/erro no
 * mesmo toast, e relança o erro para o chamador continuar tratando-o.
 */
export async function withToastFeedback<T>(
  fn: () => Promise<T>,
  messages: FeedbackMessages<T>
): Promise<T> {
  const id = `feedback-${Math.random().toString(36).slice(2)}`;
  toast.loading(messages.loading, { id });
  try {
    const data = await fn();
    toast.success(resolveMessage(messages.success, data, 'Concluído!'), { id });
    return data;
  } catch (error: any) {
    toast.error(resolveErrorMessage(error, messages.error), { id });
    throw error;
  }
}
